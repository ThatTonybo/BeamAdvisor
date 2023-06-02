// Data:
// Date#getDay -> day to display
const days = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tues',
  3: 'Wed',
  4: 'Thurs',
  5: 'Fri',
  6: 'Sat'
}

// Sounds and their paths
const sounds = {
  'alert' : {
    url : "/ui/modules/apps/beamadvisor/sounds/ping.mp3"
  }
}

// Functions (that don't require context/can have context passed in):
// Create a percentage from a current and max value
const percentage = (partial, total) => (100 * partial) / total;

// Fetch a certain percentage of a number
const getPercent = (total, percentage) => total * (percentage / 100);

// Calculate an average from an array of numbers
const average = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

// Asynchronously sleep and wait a set period of time
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Convert a string (ie. "the boys") to title case ("The Boys")
const toTitleCase = (str) => str ? typeof str === 'string' ? str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()) : '' : '';

// Ensure the passed value is a boolean
const ensureBool = (val) => {
  if (val == true) return true;
  if (val == false) return false;

  if (val == 'true') return true;
  if (val == 'false') return false;

  return false;
}

// Helper functions to update an element's text, color or background color, preventing errors if it doesn't exist
const updateElementText = (element, val) => {
  if (!element) return;
  if (!val) return;

  element.innerHTML = val;
}

const updateElementColor = (element, val) => {
  if (!element) return;
  if (!val) return;

  element.style.color = val;
}

const updateElementBackgroundColor = (element, val) => {
  if (!element) return;
  if (!val) return;

  element.style.backgroundColor = val;
}

// Canvas clear function
CanvasRenderingContext2D.prototype.clear = 
  CanvasRenderingContext2D.prototype.clear || function (preserveTransform) {
    if (preserveTransform) {
      this.save();
      this.setTransform(1, 0, 0, 1, 0, 0);
    }

    this.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (preserveTransform) {
      this.restore();
    }           
};

angular.module('beamng.apps')
.directive('beamAdvisor', ['Utils', function (Utils) {
  return {
    // Module settings
    replace: true,
    restrict: 'EA',

    // HTML layout - stored in app.html
    // CSS/stylesheet - stored in app.css
    templateUrl: '/ui/modules/apps/beamadvisor/app.html',

    // Functionality
    link: (scope, element, attrs) => {
      // Define the required streams...
      const streamsList = [
        'electrics',
        'engineInfo',
        'stats'
      ];

      // ...and add them to the stream manager
      StreamsManager.add(streamsList);

      // Register custom Lua API for speed limit - credit to Zeit
      bngApi.engineLua(`registerCoreModule('thattonybo/beamAdvisorNavAPI')`);

      // Set default settings for booleans
      if (!localStorage.getItem('beamAdvisor-lowSpaceMode')) localStorage.setItem('beamAdvisor-lowSpaceMode', false);
      if (!localStorage.getItem('beamAdvisor-playAlertSound')) localStorage.setItem('beamAdvisor-playAlertSound', true);

      if (!localStorage.getItem('beamAdvisor-alert-parkBrakeOn')) localStorage.setItem('beamAdvisor-alert-parkBrakeOn', true);
      if (!localStorage.getItem('beamAdvisor-alert-damage')) localStorage.setItem('beamAdvisor-alert-damage', true);
      if (!localStorage.getItem('beamAdvisor-alert-fuel10Percent')) localStorage.setItem('beamAdvisor-alert-fuel10Percent', true);
      if (!localStorage.getItem('beamAdvisor-alert-fuel5Percent')) localStorage.setItem('beamAdvisor-alert-fuel5Percent', true);
      if (!localStorage.getItem('beamAdvisor-alert-outOfFuel')) localStorage.setItem('beamAdvisor-alert-outOfFuel', true);

      // Define settings
      let settings = {
        speedUnit: localStorage.getItem('beamAdvisor-speedUnit') || 'mph',
        distanceUnit: localStorage.getItem('beamAdvisor-distanceUnit') || 'mi',
        tempUnit: localStorage.getItem('beamAdvisor-tempUnit') || 'f',
        fuelUnit: localStorage.getItem('beamAdvisor-fuelUnit') || 'l',
        weightUnit: localStorage.getItem('beamAdvisor-weightUnit') || 'kg',
        timeDisplay: localStorage.getItem('beamAdvisor-timeDisplay') || '24h',
        frameAppearance: localStorage.getItem('beamAdvisor-frameAppearance') || 'full',
        visibility: localStorage.getItem('beamAdvisor-visibility') || 'normal',
        lowSpaceMode: ensureBool(localStorage.getItem('beamAdvisor-lowSpaceMode')),
        playAlertSound: ensureBool(localStorage.getItem('beamAdvisor-playAlertSound')),
        alerts: {
          alertParkBrakeOn: ensureBool(localStorage.getItem('beamAdvisor-alert-parkBrakeOn')),
          alertDamage: ensureBool(localStorage.getItem('beamAdvisor-alert-damage')),
          alertFuel10Percent: ensureBool(localStorage.getItem('beamAdvisor-alert-fuel10Percent')),
          alertFuel5Percent: ensureBool(localStorage.getItem('beamAdvisor-alert-fuel5Percent')),
          alertOutOfFuel: ensureBool(localStorage.getItem('beamAdvisor-alert-outOfFuel'))
        },
        speedLimitSignEnabled: ensureBool(localStorage.getItem('beamAdvisor-speedLimitSignEnabled')) || true,
        changeSpeedColorIfExceedingLimitEnabled: ensureBool(localStorage.getItem('beamAdvisor-changeSpeedColorIfExceedingLimitEnabled')) || true,
        signType: localStorage.getItem('beamAdvisor-speedLimitSign') || 'ets2',
      }

      // Define session variables
      let activeTab = localStorage.getItem('beamAdvisor-lastActiveTab') || 'navigation';
      let odometer = Number(localStorage.getItem('beamAdvisor-lastOdometer')) || 0; // Odometer and last speed are in mph
      let lastSpeed = 0;
      let currentSpeedLimit = 0; // Speed limit is in mph
      let instantFuelConsumptionLitres;
      let instantFuelConsumptionGallons;
      let averageFuelConsumptionLitres;
      let averageFuelConsumptionGallons;
      let lastFuelLevel; // Last fuel level is in litres
      let instantAverageFuelLevels = [];
      let averageFuelLevels = [];
      let activeShortMessage = null;
      let shortMessageShown = false;
      let shortMessageLastTab = null;
      let shortMessageTimeout;
      let warningsShown = [];
      let lastDamagePercent = null;
      let dte;
      let dteMi;
      let rightClicked = false;
      let speedLimitInterval;

      // Define elements
      let elements = {
        root: document.getElementsByClassName('beam-advisor')[0],

        containers: {
          outerFrame: document.getElementsByClassName('frame-outer')[0],
          innerFrame: document.getElementsByClassName('frame-inner')[0],
          logo: document.getElementsByClassName('logo')[0]
        },

        tabs: {
          tabNavigation: document.getElementById('tab-navigation'),
          tabTrip: document.getElementById('tab-trip'),
          tabVehicle: document.getElementById('tab-vehicle'),
          tabMessages: document.getElementById('tab-messages'),
          tabConfiguration: document.getElementById('tab-configuration'),
          tabInformation: document.getElementById('tab-information')
        },

        labels: {
          topBar: {
            speed: document.getElementById('speed'),

            gear: document.getElementById('gear'),
            damage: document.getElementById('damage'),
            fuel: document.getElementById('fuel'),
            temp: document.getElementById('temp'),

            dayTime: document.getElementById('dayTime')
          },

          middleBar: {
            tabName: document.getElementById('tabName')
          },

          navigationTab: {
            speedLimitSign1: document.getElementById('speedLimitSign1'),
            speedLimitSign2: document.getElementById('speedLimitSign2'),
            speedLimitSign3: document.getElementById('speedLimitSign3'),
            speedLimit1: document.getElementById('speedLimit1'),
            speedLimit2: document.getElementById('speedLimit2'),
            speedLimit3: document.getElementById('speedLimit3')
          },

          tripTab: {
            odometer: document.getElementById('odometer'),
            instantFuelConsumption: document.getElementById('instantFuelConsumption'),
            averageFuelConsumption: document.getElementById('averageFuelConsumption'),
            dte: document.getElementById('dte')
          },

          messagesTab: {
            shortMessage: document.getElementById('shortMessage')
          },

          vehicleTab: {
            oilTemp: document.getElementById('oilTemp'),
            fuelLevel: document.getElementById('fuelLevel'),
            transmissionType: document.getElementById('transmissionType'),
            rpm: document.getElementById('rpm'),
            vehicleWeight: document.getElementById('vehicleWeight'),
            beamsDeformedBroken: document.getElementById('beamsDeformedBroken')
          },

          configurationTab: {
            speedLimitSign: document.getElementById('speedLimitSign-enabled-value'),
            changeSpeedColorIfExceedingLimit: document.getElementById('changeSpeedColorIfExceedingLimit-enabled-value'),

            lowSpaceMode: document.getElementById('lowSpaceMode-value'),
            playAlertSound: document.getElementById('playAlertSound-value'),

            alertParkBrakeOn: document.getElementById('alert-parkBrakeOn-value'),
            alertDamage: document.getElementById('alert-damage-value'),
            alertFuel10Percent: document.getElementById('alert-fuel10Percent-value'),
            alertFuel5Percent: document.getElementById('alert-fuel5Percent-value'),
            alertOutOfFuel: document.getElementById('alert-outOfFuel-value')
          }
        },

        buttons: {
          bottomBar: {
            tabNavigation: document.getElementById('btn-navigation'),
            tabTrip: document.getElementById('btn-trip'),
            tabVehicle: document.getElementById('btn-vehicle'),
            tabMessages: document.getElementById('btn-messages'),
            tabConfiguration: document.getElementById('btn-configuration'),
            tabInformation: document.getElementById('btn-information')
          },

          tripTab: {
            odometerReset: document.getElementById('btn-odometerReset')
          },

          configurationTab: {
            signTypeEts2: document.getElementById('btn-signType-ets2'),
            signTypeAts: document.getElementById('btn-signType-ats'),
            signTypeUs: document.getElementById('btn-signType-us'),

            speedUnitKph: document.getElementById('btn-speedUnit-kph'),
            speedUnitMph: document.getElementById('btn-speedUnit-mph'),

            distanceUnitKm: document.getElementById('btn-distanceUnit-km'),
            distanceUnitMi: document.getElementById('btn-distanceUnit-mi'),

            tempUnitC: document.getElementById('btn-tempUnit-c'),
            tempUnitF: document.getElementById('btn-tempUnit-f'),

            fuelUnitL: document.getElementById('btn-fuelUnit-l'),
            fuelUnitGal: document.getElementById('btn-fuelUnit-gal'),

            weightUnitKg: document.getElementById('btn-weightUnit-kg'),
            weightUnitTon: document.getElementById('btn-weightUnit-ton'),
            weightUnitLbs: document.getElementById('btn-weightUnit-lbs'),

            timeDisplay12h: document.getElementById('btn-timeDisplay-12h'),
            timeDisplay24h: document.getElementById('btn-timeDisplay-24h'),

            frameAppearanceFull: document.getElementById('btn-frameAppearance-full'),
            frameAppearanceReduced: document.getElementById('btn-frameAppearance-reduced'),

            changeMapZoom: document.getElementById('btn-changeMapZoom')
          }
        },

        checkboxes: {
          configurationTab: {
            speedLimitSign: document.getElementById('chk-speedLimitSign-enabled'),
            changeSpeedColorIfExceedingLimit: document.getElementById('chk-changeSpeedColorIfExceedingLimit-enabled'),

            lowSpaceMode: document.getElementById('chk-lowSpaceMode'),
            playAlertSound: document.getElementById('chk-playAlertSound'),

            alertParkBrakeOn: document.getElementById('chk-alert-parkBrakeOn'),
            alertDamage: document.getElementById('chk-alert-damage'),
            alertFuel10Percent: document.getElementById('chk-alert-fuel10Percent'),
            alertFuel5Percent: document.getElementById('chk-alert-fuel5Percent'),
            alertOutOfFuel: document.getElementById('chk-alert-outOfFuel')
          }
        }
      }

      // Functions (that require context):
      // Change the active tab
      const changeActiveTab = (newTabName) => {
        if (shortMessageTimeout !== undefined) {
          clearTimeout(shortMessageTimeout);
          shortMessageTimeout = undefined;
        }

        const currentTab = document.getElementById(`tab-${activeTab}`);
        const currentTabButton = document.getElementById(`btn-${activeTab}`);

        if (!currentTab) return;
        if (!currentTabButton) return;

        currentTab.classList.remove('active');
        currentTabButton.classList.remove('active');

        const newTab = document.getElementById(`tab-${newTabName}`);
        const newTabButton = document.getElementById(`btn-${newTabName}`);

        if (!newTab) return;
        if (!newTabButton) return;

        activeTab = newTabName;
        localStorage.setItem('beamAdvisor-lastActiveTab', newTabName);

        newTab.classList.add('active');
        newTabButton.classList.add('active');
      }

      // Change frame appearance
      const changeFrameAppearance = (newAppearance) => {
        if (settings.frameAppearance !== newAppearance) settings.frameAppearance = newAppearance;

        if (newAppearance === 'full') {
          elements.containers.outerFrame.classList.remove('hidden');
          elements.containers.innerFrame.classList.remove('active');
          elements.containers.logo.classList.remove('hidden');

          updateActiveButton(`frameAppearanceFull`, `frameAppearanceReduced`);
        }

        if (newAppearance === 'reduced') {
          elements.containers.outerFrame.classList.add('hidden');
          elements.containers.innerFrame.classList.add('active');
          elements.containers.logo.classList.add('hidden');

          updateActiveButton(`frameAppearanceReduced`, `frameAppearanceFull`);
        }
      }

      // Change visibility
      const changeVisibility = (newVisibility) => {
        if (settings.visibility !== newVisibility) settings.visibility = newVisibility;

        if (newVisibility === 'visible') {
          elements.root.classList.remove('gps-only');
          elements.root.classList.remove('gone');
        }

        if (newVisibility === 'gpsOnly') {
          elements.root.classList.add('gps-only');
          elements.root.classList.remove('gone');
        }

        if (newVisibility === 'hidden') {
          elements.root.classList.add('gone');
          elements.root.classList.remove('gps-only');
        }
      }

      // Helper function for the configuration page: changes the value and changes the active button
      const updateSetting = (id, val) => {
        const oldBtn = settings[id];

        settings[id] = val;

        updateActiveButton(`${id}${toTitleCase(val)}`, `${id}${toTitleCase(oldBtn)}`);

        if (id === 'signType') {
          localStorage.setItem('beamAdvisor-signType', val);
          changeSpeedLimitSign(val);
        }
      }

      const updateActiveButton = (newBtn, oldBtn = undefined) => {
        const newButton = elements.buttons.configurationTab[newBtn];
        if (newButton) newButton.classList.add('active');

        if (oldBtn) {
          const oldButton = elements.buttons.configurationTab[oldBtn];
          if (oldButton) oldButton.classList.remove('active');
        }
      }

      // Show a short message
      const showShortMessage = (msg, dismiss = true, timeout = (3 * 1000)) => {
        if (activeTab !== 'messages') shortMessageLastTab = activeTab;

        activeShortMessage = msg;
        elements.labels.messagesTab.shortMessage.innerHTML = msg;

        if (settings.playAlertSound) {
          const sound = new Audio('/ui/modules/apps/beamadvisor/sounds/ping.mp3');
          sound.play();
        }

        changeActiveTab('messages');

        shortMessageShown = true;

        if (dismiss) shortMessageTimeout = setTimeout(() => dismissCurrentShortMessage(), timeout);
      }

      // Dismiss the current short message (return to the last tab)
      const dismissCurrentShortMessage = () => {
        if (!activeShortMessage) return;
        if (!shortMessageShown) return;

        changeActiveTab(shortMessageLastTab || 'navigation');
        elements.labels.messagesTab.shortMessage.innerHTML = '<span style="color: grey;">There are no short messages at the moment</span>';

        activeShortMessage = undefined;
        shortMessageTimeout = undefined;
      }

      // Helper function to change a message's setting (enabled/disabled)
      const changeMessageSetting = (elm, labelElm, id, id2) => {
        if (elm.checked === true) {
          settings.alerts[`alert${id2}`] = true;
          localStorage.setItem(`beamAdvisor-alert-${id}`, true);
          labelElm.innerHTML = 'Enabled';
        }

        if (elm.checked === false) {
          settings.alerts[`alert${id2}`] = false;
          localStorage.setItem(`beamAdvisor-alert-${id}`, false);
          labelElm.innerHTML = 'Disabled';
        }
      }

      // Change the visible speed limit sign
      const changeSpeedLimitSign = (newID) => {
        settings.signType = newID;

        if (newID === 'ets2') {
          if (settings.speedLimitSignEnabled) elements.labels.navigationTab.speedLimitSign1.classList.remove('hide-speed-limit');

          elements.labels.navigationTab.speedLimitSign2.classList.add('hide-speed-limit');

          elements.labels.navigationTab.speedLimitSign3.classList.add('hide-speed-limit');
        }

        if (newID === 'ats') {
          elements.labels.navigationTab.speedLimitSign1.classList.add('hide-speed-limit');

          if (settings.speedLimitSignEnabled) elements.labels.navigationTab.speedLimitSign2.classList.remove('hide-speed-limit');

          elements.labels.navigationTab.speedLimitSign3.classList.add('hide-speed-limit');
        }

        if (newID === 'us') {
          elements.labels.navigationTab.speedLimitSign1.classList.add('hide-speed-limit');

          elements.labels.navigationTab.speedLimitSign2.classList.add('hide-speed-limit');

          if (settings.speedLimitSignEnabled) elements.labels.navigationTab.speedLimitSign3.classList.remove('hide-speed-limit');
        }
      }

      // Update the background color of the speed display
      const updateSpeedDisplayBackgroundColor = (currentSpeed, speedLimit) => {
        if (!settings.changeSpeedColorIfExceedingLimitEnabled) return;

        if (currentSpeed > speedLimit) {
          const overBy = currentSpeed - speedLimit;

          // min = 1-3 over
          if (overBy <= 3) {
            elements.labels.topBar.speed.classList.add('over-min');

            elements.labels.topBar.speed.classList.remove('over-mid');
            elements.labels.topBar.speed.classList.remove('over-max');
          }

          // mid = 4-9 over
          if (overBy >= 4 && overBy < 10) {
            elements.labels.topBar.speed.classList.add('over-mid');

            elements.labels.topBar.speed.classList.remove('over-min');
            elements.labels.topBar.speed.classList.remove('over-max');
          }

          // max = 10+ over
          if (overBy >= 10) {
            elements.labels.topBar.speed.classList.add('over-max');

            elements.labels.topBar.speed.classList.remove('over-min');
            elements.labels.topBar.speed.classList.remove('over-mid');
          }
        } else {
          elements.labels.topBar.speed.classList.remove('over-min');
          elements.labels.topBar.speed.classList.remove('over-mid');
          elements.labels.topBar.speed.classList.remove('over-max');
        }
      }

      // Set up button functionality:
      // Tabs
      elements.buttons.bottomBar.tabNavigation.addEventListener('click', () => changeActiveTab('navigation'));
      elements.buttons.bottomBar.tabTrip.addEventListener('click', () => changeActiveTab('trip'));
      elements.buttons.bottomBar.tabVehicle.addEventListener('click', () => changeActiveTab('vehicle'));
      elements.buttons.bottomBar.tabMessages.addEventListener('click', () => changeActiveTab('messages'));
      elements.buttons.bottomBar.tabConfiguration.addEventListener('click', () => changeActiveTab('configuration'));
      elements.buttons.bottomBar.tabInformation.addEventListener('click', () => changeActiveTab('information'));

      // Configuration
      elements.buttons.configurationTab.signTypeEts2.addEventListener('click', () => updateSetting('signType', 'ets2'));
      elements.buttons.configurationTab.signTypeAts.addEventListener('click', () => updateSetting('signType', 'ats'));
      elements.buttons.configurationTab.signTypeUs.addEventListener('click', () => updateSetting('signType', 'us'));

      elements.buttons.configurationTab.speedUnitKph.addEventListener('click', () => updateSetting('speedUnit', 'kph'));
      elements.buttons.configurationTab.speedUnitMph.addEventListener('click', () => updateSetting('speedUnit', 'mph'));

      elements.buttons.configurationTab.distanceUnitKm.addEventListener('click', () => updateSetting('distanceUnit', 'km'));
      elements.buttons.configurationTab.distanceUnitMi.addEventListener('click', () => updateSetting('distanceUnit', 'mi'));

      elements.buttons.configurationTab.tempUnitC.addEventListener('click', () => updateSetting('tempUnit', 'c'));
      elements.buttons.configurationTab.tempUnitF.addEventListener('click', () => updateSetting('tempUnit', 'f'));

      elements.buttons.configurationTab.fuelUnitL.addEventListener('click', () => updateSetting('fuelUnit', 'l'));
      elements.buttons.configurationTab.fuelUnitGal.addEventListener('click', () => updateSetting('fuelUnit', 'gal'));

      elements.buttons.configurationTab.weightUnitKg.addEventListener('click', () => updateSetting('weightUnit', 'kg'));
      elements.buttons.configurationTab.weightUnitTon.addEventListener('click', () => updateSetting('weightUnit', 'ton'));
      elements.buttons.configurationTab.weightUnitLbs.addEventListener('click', () => updateSetting('weightUnit', 'lbs'));

      elements.buttons.configurationTab.timeDisplay12h.addEventListener('click', () => updateSetting('timeDisplay', '12h'));
      elements.buttons.configurationTab.timeDisplay24h.addEventListener('click', () => updateSetting('timeDisplay', '24h'));

      elements.buttons.configurationTab.frameAppearanceFull.addEventListener('click', () => changeFrameAppearance('full'));
      elements.buttons.configurationTab.frameAppearanceReduced.addEventListener('click', () => changeFrameAppearance('reduced'));

      // UI-related/other
      elements.buttons.tripTab.odometerReset.addEventListener('click', () => odometer = 0);

      // Set up checkbox functionality:
      elements.checkboxes.configurationTab.speedLimitSign.addEventListener('click', () => {
        if (elements.checkboxes.configurationTab.speedLimitSign.checked === true) {
          settings.speedLimitSignEnabled = true;
          localStorage.setItem('beamAdvisor-speedLimitSignEnabled', true);
          elements.labels.configurationTab.speedLimitSign.innerHTML = 'Enabled';
          changeSpeedLimitSign(localStorage.getItem('beamAdvisor-signType'));
        }

        if (elements.checkboxes.configurationTab.speedLimitSign.checked === false) {
          settings.speedLimitSignEnabled = false;
          localStorage.setItem('beamAdvisor-speedLimitSignEnabled', false);
          elements.labels.configurationTab.speedLimitSign.innerHTML = 'Disabled';
          elements.root.classList.remove('low-space-mode');

          // Hide all speed limit signs
          elements.labels.navigationTab.speedLimitSign1.classList.add('hide-speed-limit');
          elements.labels.navigationTab.speedLimitSign2.classList.add('hide-speed-limit');
          elements.labels.navigationTab.speedLimitSign3.classList.add('hide-speed-limit');
        }
      });

      elements.checkboxes.configurationTab.changeSpeedColorIfExceedingLimit.addEventListener('click', () => {
        if (elements.checkboxes.configurationTab.changeSpeedColorIfExceedingLimit.checked === true) {
          settings.changeSpeedColorIfExceedingLimitEnabled = true;
          localStorage.setItem('beamAdvisor-speedLimitSignEnabled', true);
          elements.labels.configurationTab.changeSpeedColorIfExceedingLimit.innerHTML = 'Enabled';
        }

        if (elements.checkboxes.configurationTab.changeSpeedColorIfExceedingLimit.checked === false) {
          settings.changeSpeedColorIfExceedingLimitEnabled = false;
          localStorage.setItem('beamAdvisor-speedLimitSignEnabled', false);
          elements.labels.configurationTab.changeSpeedColorIfExceedingLimit.innerHTML = 'Disabled';
        }
      });

      elements.checkboxes.configurationTab.lowSpaceMode.addEventListener('click' , () => {
        if (elements.checkboxes.configurationTab.lowSpaceMode.checked === true) {
          settings.lowSpaceMode = true;
          localStorage.setItem('beamAdvisor-lowSpaceMode', true);
          elements.labels.configurationTab.lowSpaceMode.innerHTML = 'Enabled';
        }

        if (elements.checkboxes.configurationTab.lowSpaceMode.checked === false) {
          settings.lowSpaceMode = false;
          localStorage.setItem('beamAdvisor-lowSpaceMode', false);
          elements.labels.configurationTab.lowSpaceMode.innerHTML = 'Disabled';
          elements.root.classList.remove('low-space-mode');
        }
      });

      elements.checkboxes.configurationTab.playAlertSound.addEventListener('click' , () => {
        if (elements.checkboxes.configurationTab.playAlertSound.checked === true) {
          settings.playAlertSound = true;
          localStorage.setItem('beamAdvisor-playAlertSound', true);
          elements.labels.configurationTab.playAlertSound.innerHTML = 'Enabled';
        }

        if (elements.checkboxes.configurationTab.playAlertSound.checked === false) {
          settings.playAlertSound = false;
          localStorage.setItem('beamAdvisor-playAlertSound', false);
          elements.labels.configurationTab.playAlertSound.innerHTML = 'Disabled';
        }
      });

      elements.checkboxes.configurationTab.alertParkBrakeOn.addEventListener('click' , () => changeMessageSetting(elements.checkboxes.configurationTab.alertParkBrakeOn, elements.labels.configurationTab.alertParkBrakeOn, 'parkBrakeOn', 'ParkBrakeOn'));
      elements.checkboxes.configurationTab.alertDamage.addEventListener('click' , () => changeMessageSetting(elements.checkboxes.configurationTab.alertDamage, elements.labels.configurationTab.alertDamage, 'damage', 'Damage'));
      elements.checkboxes.configurationTab.alertFuel10Percent.addEventListener('click' , () => changeMessageSetting(elements.checkboxes.configurationTab.alertFuel10Percent, elements.labels.configurationTab.alertFuel10Percent, 'fuel10Percent', 'Fuel10Percent'));
      elements.checkboxes.configurationTab.alertFuel5Percent.addEventListener('click' , () => changeMessageSetting(elements.checkboxes.configurationTab.alertFuel5Percent, elements.labels.configurationTab.alertFuel5Percent, 'fuel5Percent', 'Fuel5Percent'));
      elements.checkboxes.configurationTab.alertOutOfFuel.addEventListener('click' , () => changeMessageSetting(elements.checkboxes.configurationTab.alertOutOfFuel, elements.labels.configurationTab.alertOutOfFuel, 'outOfFuel', 'OutOfFuel'));

      // Add right click handler for changing visibility:
      elements.root.addEventListener('mousedown', (e) => {
        if (e.button === 2 && rightClicked === false) {
          rightClicked = true;

          if (settings.visibility === 'normal') { changeVisibility('gpsOnly'); rightClicked = false; return; }
          if (settings.visibility === 'gpsOnly') { changeVisibility('hidden'); rightClicked = false; return; }
          if (settings.visibility === 'hidden') { changeVisibility('normal'); rightClicked = false; return; }
        }
      });

      // On load:
      // - set the frame appearance:
      changeFrameAppearance(settings.frameAppearance);
      // - set the visibility level:
      changeVisibility(settings.visibility);
      // - set the active tab:
      elements.tabs[`tab${toTitleCase(activeTab)}`].classList.add('active');
      elements.buttons.bottomBar[`tab${toTitleCase(activeTab)}`].classList.add('active');
      // - ensure signType is correct:
      settings.signType = localStorage.getItem('beamAdvisor-signType');
      // - set the active buttons on the configuration tab:
      Object.entries(settings).forEach(([key, val]) => {
        updateActiveButton(`${key}${toTitleCase(val)}`);
      });
      // - set the checkbox labels and values:
      if (settings.speedLimitSignEnabled) elements.checkboxes.configurationTab.speedLimitSign.click();
      if (settings.changeSpeedColorIfExceedingLimitEnabled) elements.checkboxes.configurationTab.changeSpeedColorIfExceedingLimit.click();

      if (settings.lowSpaceMode === true) elements.checkboxes.configurationTab.lowSpaceMode.click();
      if (settings.playAlertSound === true) elements.checkboxes.configurationTab.playAlertSound.click();

      if (settings.alerts.alertParkBrakeOn === true) elements.checkboxes.configurationTab.alertParkBrakeOn.click();
      if (settings.alerts.alertDamage === true) elements.checkboxes.configurationTab.alertDamage.click();
      if (settings.alerts.alertFuel10Percent === true) elements.checkboxes.configurationTab.alertFuel10Percent.click();
      if (settings.alerts.alertFuel5Percent === true) elements.checkboxes.configurationTab.alertFuel5Percent.click();
      if (settings.alerts.alertOutOfFuel === true) elements.checkboxes.configurationTab.alertOutOfFuel.click();
      // - set up the speed limit signs: hide non active ones and show the active one (if enabled), set all limits to - until speed limit is found out:
      if (settings.speedLimitSignEnabled) changeSpeedLimitSign(localStorage.getItem('beamAdvisor-signType'));
      updateElementText(elements.labels.navigationTab.speedLimit1, '-');
      updateElementText(elements.labels.navigationTab.speedLimit2, '-');
      updateElementText(elements.labels.navigationTab.speedLimit3, '-');

      // Clean up handler
      scope.$on('$destroy', () => {
        // Remove used streams from the stream manager
        StreamsManager.remove(streamsList);

        // Unload the navigation
        bngApi.engineLua('extensions.unload("ui_uiNavi")');

        // Unload the custom Lua API
        if (speedLimitInterval) {
          clearInterval(speedLimitInterval);
          speedLimitInterval = undefined;
        }

        //bngApi.engineLua('extensions.unload("thattonybo_beamAdvisorNavAPI")');

        // Save settings
        Object.entries(settings).forEach(([key, val]) => {
          if (key === 'alerts') return;
          localStorage.setItem(`beamAdvisor-${key}`, val);
        });

        localStorage.setItem('beamAdvisor-lastActiveTab', activeTab);
        localStorage.setItem('beamAdvisor-lastOdometer', odometer);
        localStorage.setItem('beamAdvisor-lowSpaceMode', ensureBool(settings.lowSpaceMode));
        localStorage.setItem('beamAdvisor-playAlertSound', ensureBool(settings.playAlertSound));
      });

      // Update data handler
      // Triggers when data from a requested stream changes
      scope.$on('streamsUpdate', (event, streams) => {
        // Prevent errors if the player isn't in a car
        if (elements.root.classList.contains('hide') && streams.electrics.gear !== undefined) elements.root.classList.remove('hide');
        if (elements.root.classList.contains('hide')) return;
        if (!streams.electrics.gear || streams.electrics.gear === undefined) elements.root.classList.add('hide');

        // Stop updating if hidden
        if (elements.root.classList.contains('gone')) return;
        
        // Speed
        // This is in m/s (meters per second), so m/s to mph is n * 2.237
        const rawSpeedMph = streams.electrics.wheelspeed * 2.237;
        const speedMph = Math.round(rawSpeedMph);
        const speedKph = Math.round(speedMph * 1.609344);
        updateElementText(elements.labels.topBar.speed, settings.speedUnit === 'mph' ? `${speedMph} mph` : `${speedKph} km/h`);

        // Update speed display if the speed limit is known
        if (settings.changeSpeedColorIfExceedingLimitEnabled && (currentSpeedLimit !== undefined && currentSpeedLimit !== null && currentSpeedLimit !== 0)) updateSpeedDisplayBackgroundColor(speedMph, currentSpeedLimit);

        // Calculate distance travelled and used fuel
        const distanceTravelled = rawSpeedMph * 0.1 / 3600;
        const distanceTravelledKm = distanceTravelled * 1.609344;
        const totalFuelLitres = streams.engineInfo[12];
        const totalFuelGallons = totalFuelLitres * 0.264172;
        const remainingFuelLitres = getPercent(totalFuelLitres, (streams.electrics.fuel * 100));
        const remainingFuelGallons = getPercent(totalFuelGallons, (streams.electrics.fuel * 100));
        const fuelUsed = (lastFuelLevel || remainingFuelLitres) - remainingFuelLitres;

        // If game isn't paused:
        if (rawSpeedMph > 0 && rawSpeedMph !== lastSpeed) {
          lastSpeed = rawSpeedMph;

          // Update odometer
          odometer += distanceTravelled;

          // Calculate fuel consumption and DTE if car is reasonably moving
          if (rawSpeedMph > 2) {
            const consumption = (fuelUsed / distanceTravelledKm) * 100;

            // Instant fuel consumption
            if (instantAverageFuelLevels.length < 10) {
              instantAverageFuelLevels.push(consumption);
            } else {
              // Update averaging/smoothing
              if (instantAverageFuelLevels.length === 10) {
                instantAverageFuelLevels.shift();
                instantAverageFuelLevels.push(consumption);
              }

              // Calculate the averaged consumption
              const avgInsConsumption = average(instantAverageFuelLevels);

              instantFuelConsumptionLitres = avgInsConsumption;
              instantFuelConsumptionGallons = avgInsConsumption / 3.785;
            }

            // Average fuel consumption
            if (averageFuelLevels.length < 100) {
              averageFuelLevels.push(consumption);
            } else {
              // Update averaging/smoothing
              if (averageFuelLevels.length === 100) {
                averageFuelLevels.shift();
                averageFuelLevels.push(consumption);
              }

              // Calculate the averaged consumption
              const avgConsumption = average(averageFuelLevels);

              averageFuelConsumptionLitres = avgConsumption;
              averageFuelConsumptionGallons = avgConsumption / 3.785;
            }

            // Calculate DTE (distance till empty)
            dte = remainingFuelLitres / (averageFuelConsumptionLitres * 0.01);
            dteMi = dte / 1.609;
          }

          // Update last fuel level and last distance travelled values        
          lastFuelLevel = remainingFuelLitres;
          lastDistanceTravelled = distanceTravelledKm;
        }

        // Gear
        let gear;
        if (data.electrics.gear == 0) {
		gear = 'N';
	} else if (data.electrics.gear < 0) {
		gear = `R${Math.abs(streams.engineInfo[16])}`;
	} else {
		gear = data.electrics.gear;
	}

        updateElementText(elements.labels.topBar.gear, `<img src="/ui/modules/apps/beamadvisor/images/icons/gear.png" /> ${gear}`);

        // Damage
        let damage = Math.round(percentage(Number(streams.stats ? (streams.stats.beams_deformed || 0) : 0), Number(1600)));
        if (damage > 100) damage = 100;
        
        updateElementText(elements.labels.topBar.damage, `<img src="/ui/modules/apps/beamadvisor/images/icons/damage.png" /> ${damage}%`);
        if (damage > 40) updateElementColor(elements.labels.topBar.damage, '#d13046');
        if (damage < 40) updateElementColor(elements.labels.topBar.damage, '#ffffff');

        // Fuel
        const fuel = Math.round(streams.electrics.fuel * 100);
        updateElementText(elements.labels.topBar.fuel, `<img src="/ui/modules/apps/beamadvisor/images/icons/fuel.png" /> ${fuel}%`);
        if (streams.electrics.lowfuel === 1 || fuel <= 10) updateElementColor(elements.labels.topBar.fuel, '#d13046');
        if (streams.electrics.lowfuel === 0 || fuel > 10) updateElementColor(elements.labels.topBar.fuel, '#ffffff');

        // Temperature
        const tempF = (streams.electrics.watertemp || 0).toFixed(1);
        const tempC = (((tempF - 32) * 5) / 9).toFixed(1);
        updateElementText(elements.labels.topBar.temp, `<img src="/ui/modules/apps/beamadvisor/images/icons/temp.png" /> ${settings.tempUnit === 'f' ? `${tempF}°F` : `${tempC}°C`}`)

        // Day & Time
        const date = new Date();
        const day = days[date.getDay()];
        const minutes = date.getMinutes();
        let time;
        if (settings.timeDisplay === '24h') time = `${date.getHours()}:${minutes < 10 ? `0${minutes}` : minutes}`;
        if (settings.timeDisplay === '12h') {
          let hour = date.getHours();
          let amPm = 'am';
          if (hour > 12) {
            hour = hour - 12;
            amPm = 'pm';
          }
          if (hour === 12) amPm = 'pm';
          time = `${hour}:${minutes < 10 ? `0${minutes}` : minutes} ${amPm}`;
        }
        updateElementText(elements.labels.topBar.dayTime, `${day} ${time}`);

        // Tab Name
        updateElementText(elements.labels.middleBar.tabName, toTitleCase(activeTab));

        // Update trip tab content if trip tab is active
        if (activeTab === 'trip') {
          // Odometer
          const odometerKph = odometer * 1.609344;
          updateElementText(elements.labels.tripTab.odometer, settings.distanceUnit === 'mi' ? `${odometer.toFixed(1)} mi` : `${odometerKph.toFixed(1)} km`);

          // Instant Fuel Consumption
          if (settings.fuelUnit === 'l' && instantFuelConsumptionLitres !== undefined)
          updateElementText(elements.labels.tripTab.instantFuelConsumption, instantFuelConsumptionLitres ? `${(instantFuelConsumptionLitres || 0).toFixed(2)} L per 100 ${settings.distanceUnit === 'mi' ? `mi` : `km`}` : '<span style="color: grey;">calculating...</span>');

          if (settings.fuelUnit === 'gal' && instantFuelConsumptionGallons !== undefined)
          updateElementText(elements.labels.tripTab.instantFuelConsumption, instantFuelConsumptionGallons ? `${(instantFuelConsumptionGallons || 0).toFixed(2)} gal per 100 ${settings.distanceUnit === 'mi' ? `mi` : `km`}` : '<span style="color: grey;">calculating...</span>');

          // Average Fuel Consumption
          if (settings.fuelUnit === 'l' && averageFuelConsumptionLitres !== undefined)
          updateElementText(elements.labels.tripTab.averageFuelConsumption, averageFuelConsumptionLitres ? `${(averageFuelConsumptionLitres || 0).toFixed(2)} L per 100 ${settings.distanceUnit === 'mi' ? `mi` : `km`}` : '<span style="color: grey;">calculating...</span>');

          if (settings.fuelUnit === 'gal' && averageFuelConsumptionGallons !== undefined)
          updateElementText(elements.labels.tripTab.averageFuelConsumption, averageFuelConsumptionGallons ? `${(averageFuelConsumptionGallons || 0).toFixed(2)} gal per 100 ${settings.distanceUnit === 'mi' ? `mi` : `km`}` : '<span style="color: grey;">calculating...</span>');

          // DTE (distance till empty)
          if (settings.distanceUnit === 'km' && dte !== undefined)
          updateElementText(elements.labels.tripTab.dte, dte ? `${(dte || 0).toFixed(2)} km` : '<span style="color: grey;">calculating...</span>');

          if (settings.distanceUnit === 'mi' && dte !== undefined)
          updateElementText(elements.labels.tripTab.dte, dteMi ? `${(dteMi || 0).toFixed(2)} mi` : '<span style="color: grey;">calculating...</span>');
        }

        // Update vehicle tab content if vehicle tab is active
        if (activeTab === 'vehicle') {
          // Oil Temperature
          const oilTempF = streams.electrics.oiltemp.toFixed(1);
          const oilTempC = (((oilTempF - 32) * 5) / 9).toFixed(1);
          updateElementText(elements.labels.vehicleTab.oilTemp, settings.tempUnit === 'f' ? `${oilTempF}°F` : `${oilTempC}°C`);

          // Fuel Level
          updateElementText(elements.labels.vehicleTab.fuelLevel, settings.fuelUnit === 'gal' ? `${fuel}% (${remainingFuelGallons.toFixed(1)}/${totalFuelGallons.toFixed(1)} gal)` : `${fuel}% (${remainingFuelLitres.toFixed(1)}/${totalFuelLitres.toFixed(1)} L)`);

          // Transmission Type
          updateElementText(elements.labels.vehicleTab.transmissionType, toTitleCase(streams.engineInfo[13]));

          // RPM
          const currentRpm = Math.round(streams.engineInfo[4]);
          const maxRpm = Math.round(streams.engineInfo[1]);
          updateElementText(elements.labels.vehicleTab.rpm, `${currentRpm}/${maxRpm} RPM`);

          // Vehicle Weight
          const vehicleWeightKg = streams.stats.total_weight;
          const vehicleWeightTon = (vehicleWeightKg / 1000).toFixed(2);
          const vehicleWeightLbs = (vehicleWeightKg * 2.205).toFixed(2);
          if (settings.weightUnit === 'kg') updateElementText(elements.labels.vehicleTab.vehicleWeight, `${Math.round(vehicleWeightKg).toLocaleString()} kg`);
          if (settings.weightUnit === 'ton') updateElementText(elements.labels.vehicleTab.vehicleWeight, `${vehicleWeightTon.toLocaleString()} ton`);
          if (settings.weightUnit === 'lbs') updateElementText(elements.labels.vehicleTab.vehicleWeight, `${vehicleWeightLbs.toLocaleString()} lbs`);

          // Beams Deformed/Damaged
          const beamsDeformed = streams.stats.beams_deformed;
          const beamsBroken = streams.stats.beams_broken;
          updateElementText(elements.labels.vehicleTab.beamsDeformedBroken, `${beamsDeformed.toLocaleString()}/${beamsBroken.toLocaleString()}`);
        }

        // Vehicle warnings:
        // Trying to drive with park brake on
        if (settings.alerts.alertParkBrakeOn === true) {
          if ((streams.engineInfo[18] === 1 || speedMph > 3) && streams.electrics.parkingbrake > 0 && !warningsShown.includes('parkBrakeOnWhileDriving')) {
            showShortMessage('Your parking brake is on. Release your park brake to prevent brake damage and overheating.', false);
            warningsShown.push('parkBrakeOnWhileDriving');
          }
        }
        
        if (warningsShown.includes('parkBrakeOnWhileDriving') && streams.electrics.parkingbrake === 0) {
          const index = warningsShown.findIndex(i => i === 'parkBrakeOnWhileDriving');
          warningsShown.splice(index, 1);
          dismissCurrentShortMessage();
        }

        // Damage has changed
        if (settings.alerts.alertDamage && lastDamagePercent !== undefined && lastDamagePercent !== damage && damage !== 0) showShortMessage(`Damage ${damage}%`);
        lastDamagePercent = damage;

        // 10%, 5% and 0% fuel remaining warnings
        if (settings.alerts.alertFuel10Percent && fuel <= 10 && !warningsShown.includes('fuel10Percent')) {
          showShortMessage(`10% fuel remaining`);
          warningsShown.push('fuel10Percent');
        }

        if (settings.alerts.alertFuel5Percent && fuel <= 5 && !warningsShown.includes('fuel5Percent')) {
          showShortMessage(`5% fuel remaining`);
          warningsShown.push('fuel5Percent');
        }

        if (settings.alerts.alertOutOfFuel && fuel === 0 && !warningsShown.includes('outOfFuel')) {
          showShortMessage(`Your vehicle has run out of fuel!`);
          warningsShown.push('outOfFuel');
        }
      });

      // Vehicle has been reset (regenerated) or a new vehicle was spawned in replacement
      scope.$on('VehicleReset', () => {
        odometer = Number(localStorage.getItem('beamAdvisor-lastOdometer')) || 0;
        lastSpeed = 0;
        currentSpeedLimit = 0;
        instantFuelConsumptionLitres = null;
        instantFuelConsumptionGallons = null;
        averageFuelConsumptionLitres = null;
        averageFuelConsumptionGallons = null;
        lastFuelLevel = null;
        instantAverageFuelLevels = [];
        averageFuelLevels = [];
        warningsShown = [];
        lastDamagePercent = null;
        dte = null;
        dteMi = null;
        rightClicked = false;
      });

      // Navigation
      // Everything *mostly* below this comment was written by Toastery and the BeamNG.drive team, used with permission from Toastery.
      // Some code has been tidied up or modified for use in this project, and some comments have been removed.
      // And a bit of code after this enormous block is mine.
      // Thank you :) -Tony
      var root = document.getElementById('navigation-root');
      var mapcontainer = root.children[0].children[0];
      var svg = mapcontainer.children[0]; 
      var canvas = document.getElementById('roadCanvas');
      var canvasWrapper = document.getElementById('canvasWrapper');
      var offScreenVehicleCanvas = document.getElementById("overflowVehiclesCanvas");
      var routeCanvas = document.getElementById('routeCanvas');
      var routeCanvasWrapper = document.getElementById('routeCanvasWrapper');

      var mapReady = false;
      var viewParams = [];
      var bgImage = null;

      var boolConfig = [false, false, true, true, false, false, true, false];

      var baseMapZoomSpeed = 25;
      var mapZoomSpeed = 0;
      var mapScale = 1;
      var routeScale = 1/3;
      var zoomStates = [1000, 500, 0, -500, -1000, -2000, -4000, -8000, -16000];
      var roadScaleZoom = [0, 0, 0, 0, 0, 0.0385, 0.1, 0.225, 0.475];
      var zoomMags = [];

      var baseZoomLevel = Math.floor(zoomStates.length / 2);

      for (var i = 0; i < zoomStates.length; i++) {
        if (zoomStates[i] < zoomStates[baseZoomLevel]) zoomMags[i] = zoomStates[baseZoomLevel] / zoomStates[i];
        else zoomMags[i] = Math.pow(2, (baseZoomLevel - i));
      }

      var zoomSlot = baseZoomLevel;
      var mapZoom = zoomStates[baseZoomLevel];
      var vehicleShapes = {};
      var lastcontrolID = -1;
      var visibilitySlots = [0.2, 0.6, 0.8, 1]
      var activeVisibilitySlot = 1;

      var init = false;
      var prevMarkers = [];

      scope.$on('NavigationMapUpdate', (event, data) => {
        if (!mapReady || !data) return;

        updateNavMap(data);
        centerMap(data.objects[data.controlID]);
      });

      scope.$on('NavigationMap', (event, data) => {
        if (data && !init) {
          setupMap(data);
          init = true;
        }
      });

      scope.$on('NavigationGroundMarkersUpdate', (event, data) => {       
        if (routeCanvas == null) return;

        var ctx = routeCanvas.getContext("2d");

        if (!data || !data.markers) {
          ctx.clear();
          return;
        }

        if (!data.markers.length) {
          ctx.clear();
          return;
        }

        if (!prevMarkers.length && data) {
          if (data) {
            ctx.beginPath();

            data.color = '#CF0C0CFF';

            ctx.strokeStyle = data.color;
            ctx.lineWidth = 16 * routeScale;

            var canvasWidth = routeCanvas.width * 0.5;
            var canvasHeight = routeCanvas.height * 0.5;
            var mapFac = routeScale;

            if (mapScale != 0) mapFac = mapFac / mapScale;
            var markers = data.markers;

            ctx.moveTo(-markers[0] * mapFac + canvasWidth, markers[1] * mapFac + canvasHeight);

            for (var i = 2; i < markers.length; i += 2) {
              ctx.lineTo(-markers[i] * mapFac + canvasWidth, markers[i+1] * mapFac + canvasHeight);
            }
            
            ctx.stroke();
          }
        }

        if (prevMarkers.length) {
          ctx.clearRect(0, 0, routeCanvas.width, routeCanvas.height);
          ctx.stroke();
          
          ctx.beginPath();

          data.color = '#CF0C0CFF';

          ctx.strokeStyle = data.color;
          ctx.lineWidth = 16 * routeScale;

          var canvasWidth = routeCanvas.width * 0.5;
          var canvasHeight = routeCanvas.height * 0.5;
          var mapFac = routeScale;

          if (mapScale != 0) mapFac = mapFac / mapScale;
          var markers = data.markers;

          ctx.moveTo(-markers[0] * mapFac + canvasWidth, markers[1] * mapFac + canvasHeight);

          for (var i = 2; i < markers.length; i += 2) {
            ctx.lineTo(-markers[i] * mapFac + canvasWidth, markers[i+1] * mapFac + canvasHeight);
          }
          
          ctx.stroke();
        }

        prevMarkers = data.markers;
      });

      // License: CC BY 4.0
      // https://stackoverflow.com/questions/29377748/draw-a-line-with-two-different-sized-ends/29379772
      const _varLine = (ctx, x1, y1, x2, y2, w1, w2, color) => {
        var dx = (x2 - x1);
        var dy = (y2 - y1);

        // length of the AB vector
        var length = dx*dx + dy*dy;
        if (length == 0) return; // exit if zero length
        length = Math.sqrt(length);
        w1 *= 0.5;
        w2 *= 0.5;

        dx /= length;
        dy /= length;
        var shiftx = - dy * w1   // compute AA1 vector's x
        var shifty =   dx * w1   // compute AA1 vector's y
        ctx.beginPath();
        ctx.fillStyle = color
        ctx.moveTo(x1 + shiftx, y1 + shifty);
        ctx.lineTo(x1 - shiftx, y1 - shifty); // draw A1A2
        shiftx =  - dy * w2 ;   // compute BB1 vector's x
        shifty =    dx * w2 ;   // compute BB1 vector's y
        ctx.lineTo(x2 - shiftx, y2 - shifty); // draw A2B1
        ctx.lineTo(x2 + shiftx, y2 + shifty); // draw B1B2
        ctx.closePath(); // draw B2A1

        ctx.arc(x1, y1, w1, 0, 2 * Math.PI);
        ctx.arc(x2, y2, w2, 0, 2 * Math.PI);

        ctx.fill();
      }

      const _createLine = (p1, p2, color) => {
        var ctx = canvas.getContext("2d");

        if (Math.abs(p1.radius - p2.radius) > 0.2 ) _varLine(ctx, p1.x, p1.y, p2.x, p2.y, p1.radius, p2.radius, color);
        else {
          ctx.beginPath();

          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(p1.radius, p2.radius);
          ctx.lineCap = 'round';

          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);

          ctx.stroke();
        }
      }

      const centerMap = async (obj) => {
        var speedZoomMultiplier = 2;

        if (zoomStates[zoomSlot] <= 0 && boolConfig[2] === true) {
          if (boolConfig[4] === true) {
            obj.dir = [0, 0, 0, 0, 1];
            
            if (obj.rot >= 90 || obj.rot <= -90) {
              obj.dir[0] = 1;

              if (obj.rot >= 90) obj.dir[4] = 1;
              else obj.dir[4] = -1;
            } else if (obj.rot <= 90 && obj.rot >= -90) obj.dir[2] = -1;

            if (obj.rot <= 180 && obj.rot >= 0) obj.dir[1] = 1;
            else if (obj.rot >= -180 && obj.rot <= 0) obj.dir[3] = -1;

            obj.vel = [
              (((obj.dir[0] * obj.speed) * (obj.rot / (180 * obj.dir[4]))) + ((obj.dir[2] * obj.speed) * ((obj.rot + 90) / 90))),
              ((obj.dir[1] * obj.speed) * Math.min((90 / obj.rot), 1) + ((obj.dir[3] * obj.speed) * Math.min((-90 / obj.rot), 1)))
            ];

            var zoomX = -(1 + (obj.vel[1]) * 1.5);
            var zoomY = 1 + (obj.vel[0]) * 1.5;
            var zoom = Math.min(1 + (obj.speed * 3.6) * 1.5, 200);
          } else {
            var zoomX = 0;
            var zoomY = Math.min(1 + (obj.speed * 3.6) * 1.5, 200);;
            var zoom = Math.min(1 + (obj.speed * 3.6) * 1.5, 200);
          }
        } else {
          var zoomX = 0;
          var zoomY = 0;
          var zoom = 0;
        }

        var focusX = -obj.pos[0] / mapScale;
        var focusY = obj.pos[1] / mapScale;
        var borderWidth = root.children[0].clientWidth;
        var borderHeight = root.children[0].clientHeight;
        var degreeNorth = boolConfig[4] === false ? (obj.rot - 90) : 90;
        var npx = - Math.cos(degreeNorth * Math.PI / 180) * borderWidth * 0.75;
        var npy = borderHeight * 0.5 - Math.sin(degreeNorth * Math.PI / 180) * borderHeight * 0.75;
        var translateX = (((viewParams[0]) + borderWidth/2 - 10) + focusX + 10 + (zoomX / 2));

        if (boolConfig[6] == 'true') {
          var translateY = (((viewParams[1]) + borderHeight/2) + focusY + (zoomY / 2));
        } else {
          var translateY = (((viewParams[1]) + borderHeight/1.5) + focusY + (zoomY / 2));
        }

        if (boolConfig[4] === false) {
          mapcontainer.style.transform = "translate3d(" + translateX + "px, " + translateY + "px," + (mapZoom - (zoom * speedZoomMultiplier)) + "px)" + "rotateX(" + 0 + (zoom / 10) + "deg)" + "rotateZ(" + (180 + Utils.roundDec(obj.rot, 2)) + "deg)";
          mapcontainer.style.transformOrigin = (((viewParams[0] * -1)) - focusX) + "px " + ((viewParams[1] * -1) - focusY) + "px";
        } else mapcontainer.style.transform = "translate3d(" + translateX + "px, " + translateY + "px," + (mapZoom - (zoom * speedZoomMultiplier)) + "px)" + "rotateX(" + 0 + (zoom / 10) + "deg)" + "rotateZ(" + (270 + Utils.roundDec(90, 2)) + "deg)";
      }

      const updatePlayerShape = (key, data) => {
        if (vehicleShapes[key]) vehicleShapes[key].remove();

        var isControlled = (key == data.controlID);
        var obj = data.objects[key];

        if (isControlled) {
          if (obj.type == 'Camera') {
            vehicleShapes[key] = hu('<circle>', svg);
            vehicleShapes[key].attr('cx', 0);
            vehicleShapes[key].attr('cy', 0);
            vehicleShapes[key].attr('r', 8);
            vehicleShapes[key].css('fill', '#FD6A00');
          } else {
            vehicleShapes[key] = hu('<use>', svg);
            vehicleShapes[key].attr({ 'xlink:href': '#vehicleMarker' });
          }
        } else {
          vehicleShapes[key] = hu('<circle>', svg);
          vehicleShapes[key].attr('cx', 0);
          vehicleShapes[key].attr('cy', 0);
          vehicleShapes[key].attr('r', 10);
          vehicleShapes[key].css('stroke', '#FFFFFF');
          vehicleShapes[key].css('stroke-width', '3px');
          vehicleShapes[key].css('fill', '#A3D39C');
        }
      }

      const updateNavMap = (data) => {
        if (lastcontrolID != data.controlID) {
          if (lastcontrolID != -1) updatePlayerShape(lastcontrolID, data);

          updatePlayerShape(data.controlID, data);
          lastcontrolID = data.controlID;
        }

        var borderWidth = offScreenVehicleCanvas.width;
        var borderHeight = offScreenVehicleCanvas.height;
        var ctx = offScreenVehicleCanvas.getContext('2d');

        ctx.beginPath();
        ctx.clearRect(0, 0, borderWidth, borderHeight);
        ctx.fill();
        ctx.closePath();

        for (var key in data.objects) {
          var o = data.objects[key];
          var p = data.objects[data.controlID];

          if (vehicleShapes[key]) {
            var px = -o.pos[0] / mapScale;
            var py = o.pos[1] / mapScale;
            var rot = Math.floor(-o.rot);
            
            if (boolConfig[3] == 'true') var iconScale = 1 + mapZoom / -500 * 0.151;
            else var iconScale = 1;

            var show = 1;

            if (o.marker == null) o.marker = 'default';
            if (o.marker == 'hidden') show = 0;

            vehicleShapes[key].attr({ "transform": "translate(" + px + "," + py + ") scale(" + iconScale + "," + iconScale + ") rotate(" + rot + ")", "opacity": show });
          } else updatePlayerShape(key, data);
        }

        for (var key in vehicleShapes) {
          if (!data.objects[key]) {
            vehicleShapes[key].remove();
            delete vehicleShapes[key];
          }
        }
      }

      const setupMap = async (data) => {
        await sleep(250);

        if (canvas == null) return;

        if (data != null) {
          root.style.position = 'relative';
          root.style.margin = '0px';
          root.style.perspective = '2000px';
          root.style.backgroundColor = 'rgba(50, 50, 50, ' + visibilitySlots[activeVisibilitySlot] + ')';

          var borderWidth = offScreenVehicleCanvas.width;
          var borderHeight = offScreenVehicleCanvas.height;
          var ctx = offScreenVehicleCanvas.getContext('2d');

          ctx.clearRect(0, 0, borderWidth, borderHeight);
          svg.style.transform = "scale(-1, -1)";

          var minX = 999, maxX = -999;
          var minY = 999, maxY = -999;

          if (data.terrainSize) {
            var terrainSizeX = Math.min(data.terrainSize[0] / Math.min(data.squareSize, 1) / mapScale, 2048);
            var terrainSizeY = Math.min(data.terrainSize[1] / Math.min(data.squareSize, 1) / mapScale, 2048);

            viewParams = [
              (-terrainSizeX / 2),
              (-terrainSizeY / 2),
              terrainSizeX,
              terrainSizeY
            ];
          } else viewParams = [(-512), (-512), 1024, 1024];

          if (data.terrainSize) mapScale = Math.max(Math.max(data.terrainSize[0], data.terrainSize[1]) / 2048, 1);
          else mapScale = 1;

          mapcontainer.style.width = viewParams[2] + "px";
          mapcontainer.style.height = viewParams[3] + "px";

          svg.setAttribute('viewBox', viewParams.join(' '));

          var ctx = canvas.getContext("2d");

          canvas.style.width = (viewParams[2] * 2) + "px";
          canvas.style.height = (viewParams[3] * 2) + "px";
          canvas.width = viewParams[2] * 2;
          canvas.height = viewParams[3] * 2;
          canvasWrapper.style.width = canvas.style.width;
          canvasWrapper.style.height = canvas.style.height;

          ctx.width = (viewParams[2] * 2);
          ctx.height = (viewParams[3] * 2);

          ctx.clearRect(0, 0, viewParams[2]*2, viewParams[3]*2);

          var ctxR = routeCanvas.getContext("2d");

          routeCanvas.style.width = (viewParams[2] * 2) + "px";
          routeCanvas.style.height = (viewParams[3] * 2) + "px";
          routeCanvas.width = viewParams[2] * 2 * routeScale;
          routeCanvas.height = viewParams[3] * 2 * routeScale;
          routeCanvasWrapper.style.width = routeCanvas.style.width;
          routeCanvasWrapper.style.height = routeCanvas.style.height;

          ctxR.width = (viewParams[2] * 2 * routeScale);
          ctxR.height = (viewParams[3] * 2 * routeScale);

          ctxR.clearRect(0, 0, viewParams[2] * 2 * routeScale, viewParams[3] * 2 * routeScale);

          var nodes = data.nodes;

          for (var key in nodes) {
            var el = nodes[key];

            if (-el.pos[0] < minX) minX = -el.pos[0];
            if (-el.pos[0] > maxX) maxX = -el.pos[0];
            if (el.pos[1] < minY) minY = el.pos[1];
            if (el.pos[1] > maxY) maxY = el.pos[1];
          }

          if (data.minimapImage && data.terrainOffset && data.terrainSize) {
            if (bgImage != null) bgImage.remove();

            bgImage = hu('<image>', svg).attr({
              'x': data.terrainOffset[0] / mapScale,
              'y': data.terrainOffset[1] / mapScale,
              'width': data.terrainSize[0] / mapScale,
              'height': data.terrainSize[1] / mapScale,
              'transform': "scale(-1,-1)",
              'xlink:href': "/" + data.minimapImage,
            }).prependTo(svg);
          }

          if (boolConfig[5] == 'true') {
            if (maxX == -999 && minX == 999 && maxY == -999 && minY == 999) {
              minX = -2048;
              maxX = 2048;
              minY = -2048;
              maxY = 2048;
            }

            var dx = 50;

            for (var x = minX; x <= maxX * dx + 1; x += dx) {
              _createLine({ x: x, y: minY * dx, radius: 0.7 + 1 / mapScale * (roadScaleZoom[zoomSlot] * mapScale + 1)}, { x: x, y: maxY * dx, radius: 0.7 + 1 / mapScale * (roadScaleZoom[zoomSlot] * mapScale + 1)}, '#FFFFFF55');
            }

            var dy = 50;

            for (var y = minY; y <= maxY * dy + 1; y += dy) {
              _createLine({ x: minX * dy, y: y, radius: 0.7 + 1 / mapScale * (roadScaleZoom[zoomSlot] * mapScale + 1)}, { x: maxX * dy, y: y, radius: 0.7 + 1 / mapScale * (roadScaleZoom[zoomSlot] * mapScale + 1)}, '#FFFFFF55');
            }
          }

          function getDrivabilityColor(d) {
            if (d <= 0.1) return '#967864';
            if (d > 0.1 && d < 0.9) return '#969678';
            return '#DCDCDC';
          }

          function drawRoads(drivabilityMin, drivabilityMax) {
            for (var key in nodes) {
              var el = nodes[key];

              if (el.links !== undefined) {
                var d = '';
                var first = true;

                for (var key2 in el.links) {
                  var el2 = nodes[key2];
                  var drivability = el.links[key2].drivability;

                  if (drivability >= drivabilityMin && drivability <= drivabilityMax) {
                    _createLine(
                      {
                        x: -el.pos[0] / mapScale + viewParams[2],
                        y: el.pos[1] / mapScale + viewParams[3],
                        radius: Math.min(Math.max(el.radius, 0), 5) * 3 / mapScale * (roadScaleZoom[zoomSlot] * mapScale + 1)
                      },
                      {
                        x: -el2.pos[0] / mapScale + viewParams[2],
                        y: el2.pos[1] / mapScale + viewParams[3],
                        radius: Math.min(Math.max(el2.radius, 0), 5) * 3 / mapScale * (roadScaleZoom[zoomSlot] * mapScale + 1)
                      },
                      getDrivabilityColor(drivability)
                    );
                  }
                }
              }
            }
          }

          drawRoads(0, 0.1);
          drawRoads(0.1, 0.9);
          drawRoads(0.9, 1);

          mapReady = true;
        }
      }

      function changeGPSMapZoom() {
        zoomSlot++;
        mapZoomSlot = zoomSlot < zoomStates.length ? zoomSlot : zoomSlot = 0;
        
          async function animatedZoom() {
            mapZoomSpeed = Math.ceil(baseMapZoomSpeed*(zoomStates[mapZoomSlot]-mapZoom)/zoomStates[baseZoomLevel])
            if (mapZoom > zoomStates[mapZoomSlot] )
            var i = 0
            while (mapZoom != zoomStates[mapZoomSlot]) {
              i++
              if (i > 1000) {
                mapZoom = zoomStates[mapZoomSlot] // makes sure it doesnt get stuck in an infinite loop
                break;
              } else if (mapZoom > zoomStates[0]) {
                mapZoom = zoomStates[mapZoomSlot] // resets to how it should be
                break;
              } else if (mapZoom < zoomStates[zoomStates.length - 1]) {
                mapZoom = zoomStates[zoomStates.length - 1] // resets to how it should be
                break;
              } else {
                mapZoom = mapZoom - mapZoomSpeed
                if (mapZoomSpeed < 0) {
                  if (mapZoom + 20 >= zoomStates[mapZoomSlot]) {
                    mapZoom = zoomStates[mapZoomSlot];
                    break;
                  }
                } else {
                  if (mapZoom - 20 <= zoomStates[mapZoomSlot]) {
                    mapZoom = zoomStates[mapZoomSlot];
                    break;
                  }
                }
                await sleep(15);
              }
            }
            setupMap(null);
          }
          animatedZoom();
      }

      // Load navigation
      bngApi.engineLua(`extensions.ui_uiNavi.requestUIDashboardMap()`);
      bngApi.engineLua(`extensions.core_collectables.sendUIState()`);
      bngApi.engineLua(`if gameplay_missions_missionEnter then gameplay_missions_missionEnter.sendMissionLocationsToMinimap() end`);

      // Back to my code:
      // Load custom Lua API for getting speed limit - credit to Zeit, again
      bngApi.engineLua(`extensions.load("thattonybo_beamAdvisorNavAPI")`);

      // Change map zoom butrton functionality
      // This has to be done here so the function exists
      elements.buttons.configurationTab.changeMapZoom.addEventListener('click', () => changeGPSMapZoom());

      // Update speed limit every 2 seconds
    speedLimitInterval = setInterval(() => {
      bngApi.engineLua(`thattonybo_beamAdvisorNavAPI.getSpeedLimit()`, function (data) {
        if (elements.root.classList.contains('hide')) return;
        if (elements.root.classList.contains('gone')) return;

        const speedLimitMph = Math.round(data.speedLimit * 2.237);

        if (currentSpeedLimit !== speedLimitMph) {
          if (!speedLimitMph || speedLimitMph === 0) currentSpeedLimit = '-';
          else currentSpeedLimit = speedLimitMph;

          const speedLimitKph = Math.round(speedLimitMph * 1.609);

          updateElementText(elements.labels.navigationTab.speedLimit1, settings.speedUnit === 'mph' ? speedLimitMph : speedLimitKph);
          updateElementText(elements.labels.navigationTab.speedLimit2, settings.speedUnit === 'mph' ? speedLimitMph : speedLimitKph);
          updateElementText(elements.labels.navigationTab.speedLimit3, settings.speedUnit === 'mph' ? speedLimitMph : speedLimitKph);
        }
      });
    }, (2 * 1000));
    }
  };
}]);

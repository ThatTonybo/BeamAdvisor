// Data
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

// Functions (that don't require context/can have context passed in)
// Create a percentage from a current and max value
const percentage = (partial, total) => (100 * partial) / total;

// Fetch a certain percentage of a number
const getPercent = (total, percentage) => total * (percentage / 100);

// Calculate an average from an array of numbers
const average = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

// Asynchronously sleep and wait a set period of time
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Convert a string (ie. "the boys") to title case ("The Boys")
const toTitleCase = (str) => str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

// Helper functions to update an element's text or color, preventing errors if it doesn't exist
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

      // Define settings
      let settings = {
        speedUnit: localStorage.getItem('beamAdvisor-speedUnit') || 'mph',
        distanceUnit: localStorage.getItem('beamAdvisor-distanceUnit') || 'mi',
        tempUnit: localStorage.getItem('beamAdvisor-tempUnit') || 'f',
        fuelUnit: localStorage.getItem('beamAdvisor-fuelUnit') || 'l',
        weightUnit: localStorage.getItem('beamAdvisor-weightUnit') || 'kg',
        timeDisplay: localStorage.getItem('beamAdvisor-timeDisplay') || '24h',
        frameAppearance: localStorage.getItem('beamAdvisor-frameAppearance') || 'full'
      }

      // Define session variables
      let activeTab = localStorage.getItem('beamAdvisor-lastActiveTab') || 'navigation';
      let odometer = Number(localStorage.getItem('beamAdvisor-lastOdometer')) || 0; // **Odometer and last speed are in mph**
      let lastSpeed = 0;
      let instantFuelConsumptionLitres;
      let instantFuelConsumptionGallons;
      let averageFuelConsumptionLitres;
      let averageFuelConsumptionGallons;
      let lastFuelLevel; // Last fuel level is in litres
      let lastDistanceTravelled; // Last distance travelled is in km
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
            frameAppearanceReduced: document.getElementById('btn-frameAppearance-reduced')
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

        if (activeShortMessage) {
          shortMessageLastTab = newTabName;
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

        newTab.classList.add('active');
        newTabButton.classList.add('active');
      }

      // Change frame appearance
      const changeFrameAppearance = (newAppearance) => {
        settings.frameAppearance = newAppearance;

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

      // Helper function for the configuration page: changes the value and changes the active button
      const updateSetting = (id, val) => {
        const oldBtn = settings[id];

        settings[id] = val;

        updateActiveButton(`${id}${toTitleCase(val)}`, `${id}${toTitleCase(oldBtn)}`);
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

        changeActiveTab('messages');

        activeShortMessage = msg;
        elements.labels.messagesTab.shortMessage.innerHTML = msg;

        const sound = new Audio('/ui/modules/apps/beamadvisor/sounds/ping.mp3');
        sound.play();

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

      // Set up button functionality:
      // Tabs
      elements.buttons.bottomBar.tabNavigation.addEventListener('click', () => changeActiveTab('navigation'));
      elements.buttons.bottomBar.tabTrip.addEventListener('click', () => changeActiveTab('trip'));
      elements.buttons.bottomBar.tabVehicle.addEventListener('click', () => changeActiveTab('vehicle'));
      elements.buttons.bottomBar.tabMessages.addEventListener('click', () => changeActiveTab('messages'));
      elements.buttons.bottomBar.tabConfiguration.addEventListener('click', () => changeActiveTab('configuration'));
      elements.buttons.bottomBar.tabInformation.addEventListener('click', () => changeActiveTab('information'));

      // Configuration
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

      // Ui-related/other
      elements.buttons.tripTab.odometerReset.addEventListener('click', () => odometer = 0);

      // On load:
      // - set the frame appearance
      changeFrameAppearance(settings.frameAppearance);
      // - set the active tab
      elements.tabs[`tab${toTitleCase(activeTab)}`].classList.add('active');
      elements.buttons.bottomBar[`tab${toTitleCase(activeTab)}`].classList.add('active');
      // - set the active buttons on the configuration tab
      Object.entries(settings).forEach(([key, val]) => {
        updateActiveButton(`${key}${toTitleCase(val)}`);
      });

      // Clean up handler
      scope.$on('$destroy', () => {
        // Remove used streams from the stream manager
        StreamsManager.remove(streamsList);

        // Unload the navigation
        bngApi.engineLua('extensions.unload("ui_uiNavi")');

        // Save settings
        Object.entries(settings).forEach(([key, val]) => {
          localStorage.setItem(`beamAdvisor-${key}`, val);
        });

        localStorage.setItem('beamAdvisor-lastActiveTab', activeTab);
        localStorage.setItem('beamAdvisor-lastOdometer', odometer);
      });

      // Update data handler
      // Triggers when data from a requested stream changes
      scope.$on('streamsUpdate', (event, streams) => {
        // Prevent errors if the player isn't in a car
        if (elements.containers.outerFrame.classList.contains('hide') && streams.electrics.watertemp !== undefined) elements.containers.outerFrame.classList.remove('hide');
        if (elements.containers.outerFrame.classList.contains('hide')) return;
        if (!streams.electrics.watertemp || streams.electrics.watertemp === undefined) elements.containers.outerFrame.classList.add('hide');

        // Speed
        // (Airspeed * 1.12) * 2 gives a (mostly) accurate speed in MPH
        const rawSpeedMph = (streams.electrics.airspeed * 1.12) * 2;
        const speedMph = Math.round(rawSpeedMph);
        const speedKph = Math.round(speedMph * 1.609344);
        updateElementText(elements.labels.topBar.speed, settings.speedUnit === 'mph' ? `${speedMph} mph` : `${speedKph} km/h`);

        // Calculate distance travelled and used fuel
        const distanceTravelled = rawSpeedMph * 0.1 / (60 * 60);
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
            dte = remainingFuelLitres / (averageFuelConsumptionLitres / 100);
            dteMi = dte / 1.609;
          }

          // Update last fuel level and last distance travelled values        
          lastFuelLevel = remainingFuelLitres;
          lastDistanceTravelled = distanceTravelledKm;
        }

        // Gear
        let gear;
        if (streams.engineInfo[16] === 0) gear = 'N'; // Neutral
        else if (streams.engineInfo[16] <= -1) gear = `R${Math.abs(streams.engineInfo[16])}`; // Reverse
        else {
          if (streams.engineInfo[13].toLowerCase() === 'auto') gear = `A${streams.engineInfo[16]}`;
          else gear = streams.engineInfo[16];
        }
        updateElementText(elements.labels.topBar.gear, `<img src="/ui/modules/apps/beamadvisor/images/icons/gear.png" /> ${gear}`);

        // Damage
        let damage = Math.round(percentage(Number(streams.stats ? (streams.stats.beams_deformed || 0) : 0), Number(1600)));
        if (damage > 100) damage = 100;
        
        updateElementText(elements.labels.topBar.damage, `<img src="/ui/modules/apps/beamadvisor/images/icons/damage.png" /> ${damage}%`);
        if (damage > 40) updateElementColor(elements.labels.topBar.damage, '#d13046');

        // Fuel
        const fuel = Math.round(streams.electrics.fuel * 100);
        updateElementText(elements.labels.topBar.fuel, `<img src="/ui/modules/apps/beamadvisor/images/icons/fuel.png" /> ${fuel}%`);
        if (streams.electrics.lowfuel === 1 || fuel <= 10) updateElementColor(elements.labels.topBar.fuel, '#d13046');

        // Temperature
        const tempF = streams.electrics.watertemp.toFixed(1);
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
          updateElementText(elements.labels.vehicleTab.fuelLevel, settings.fuelUnit === 'gal' ? `${remainingFuelGallons.toFixed(1)}/${totalFuelGallons.toFixed(1)} gal` : `${remainingFuelLitres.toFixed(1)}/${totalFuelLitres.toFixed(1)} L`);

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
        if ((streams.engineInfo[18] === 1 || speedMph > 3) && streams.electrics.parkingbrake > 0 && !warningsShown.includes('parkBrakeOnWhileDriving')) {
          showShortMessage('Your park brake is on. Release your park brake to prevent brake damage and overheating.', false);
          warningsShown.push('parkBrakeOnWhileDriving');
        }
        
        if (warningsShown.includes('parkBrakeOnWhileDriving') && streams.electrics.parkingbrake === 0) {
          const index = warningsShown.findIndex(i => i === 'parkBrakeOnWhileDriving');
          warningsShown.splice(index, 1);
          dismissCurrentShortMessage();
        }

        // Damage has changed
        if (lastDamagePercent !== undefined && lastDamagePercent !== damage && damage !== 0) showShortMessage(`Damage ${damage}%`);
        lastDamagePercent = damage;

        // 10%, 5% and 0% fuel remaining warnings
        if (fuel <= 10 && !warningsShown.includes('fuel10Percent')) {
          showShortMessage(`10% fuel remaining`);
          warningsShown.push('fuel10Percent');
        }

        if (fuel <= 5 && !warningsShown.includes('fuel5Percent')) {
          showShortMessage(`5% fuel remaining`);
          warningsShown.push('fuel5Percent');
        }

        if (fuel === 0 && !warningsShown.includes('fuel0Percent')) {
          showShortMessage(`Your vehicle has run out of fuel!`);
          warningsShown.push('fuel0Percent');
        }
      });

      // Vehicle has been reset (regenerated) or a new vehicle was spawned in replacement
      scope.$on('VehicleReset', () => {
        odometer = 0;
        instantFuelConsumptionLitres = null;
        instantFuelConsumptionGallons = null;
        averageFuelConsumptionLitres = null;
        averageFuelConsumptionGallons = null;
        lastDamagePercent = null;
        lastDistanceTravelled = null;
        lastFuelLevel = null;
        lastSpeed = null;
        warningsShown = [];
        instantAverageFuelLevels = [];
        averageFuelLevels = [];
        dte = null;
        dteMi = null;
      });

      // Navigation
      // Everything below comment was written by Toastery and the BeamNG.drive team, used with permission from Toastery.
      // Some code has been tidied up or modified for use in this project, and some comments have been removed.
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

      bngApi.engineLua('extensions.ui_uiNavi.requestUIDashboardMap()');
      bngApi.engineLua(`extensions.core_collectables.sendUIState()`);
      bngApi.engineLua(`if gameplay_missions_missionEnter then gameplay_missions_missionEnter.sendMissionLocationsToMinimap() end`);
    }
  };
}]);
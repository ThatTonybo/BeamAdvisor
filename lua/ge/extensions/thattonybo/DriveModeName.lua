local M = {}

local function updateGFX(dt)
  local driveModeName = ""

  if controller.getController("driveModes") then
    -- For newer ESC systems
    local driveModeKey = controller.getController("driveModes").getCurrentDriveModeKey()
    driveModeName = v.data.driveModes.modes[driveModeKey].name
  elseif controller.getController("esc") then
    -- For older ESC systems
    local escConfigData = controller.getController("esc").getCurrentConfigData()
    driveModeName = escConfigData.name
  end

  if streams.willSend("driveModesInfo") then
    local streamData = {
      currentDriveMode = {
        name = driveModeName
      }
    }
    gui.send("driveModesInfo", streamData)
  end
end

M.updateGFX = updateGFX

return M
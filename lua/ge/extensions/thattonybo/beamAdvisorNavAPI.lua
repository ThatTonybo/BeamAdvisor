local M = {}

local function getSpeedLimit()
local n1, n2 = map.findClosestRoad(be:getPlayerVehicle(0):getPosition())
local mapNodes = map.getMap().nodes
local link = mapNodes[n1].links[n2] or mapNodes[n2].links[n1]
return link
end

M.getSpeedLimit = getSpeedLimit

return M
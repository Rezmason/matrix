local gfx <const> = playdate.graphics

local screenWidth <const> = playdate.display.getWidth()
local screenHeight <const> = playdate.display.getHeight()
local glyphWidth <const> = 20
local numColumns <const> = math.floor(screenWidth / glyphWidth)
local numRows <const> = math.floor(screenHeight / glyphWidth)
local numCells <const> = numColumns * numRows

local numGlyphs <const> = 133
local glyphs = gfx.imagetable.new('images/matrix')
-- local glyphMap = gfx.tilemap.new()
-- glyphMap:setImageTable(glyphs)
-- glyphMap:setSize(numColumns, numRows)

local ditherType = gfx.image.kDitherTypeAtkinson
local image = gfx.image.new(glyphWidth, glyphWidth, gfx.kColorBlack)
local numFades <const> = 15
local fades = gfx.imagetable.new(numFades)
for i = 1, numFades do
	fades:setImage(i, image:fadedImage(i / numFades, ditherType))
end
-- local fadeMap = gfx.tilemap.new()
-- fadeMap:setImageTable(fades)
-- fadeMap:setSize(numColumns, numRows)

local minSpeed <const> = 0.15
local maxSpeed <const> = 1
local time = 0
local speed = maxSpeed

function randomFloat()
	return math.random(10000) / 10000
end

local sqrt2 <const> = math.sqrt(2)
local sqrt5 <const> = math.sqrt(5)
function wobble(x)
	return x + 0.3 * math.sin(sqrt2 * x) + 0.2 * math.sin(sqrt5 * x)
end

local cells = {}
for x = 1, numColumns do
	local columnTimeOffset = randomFloat() * 1000
	local columnSpeedOffset = randomFloat() * 0.5 + 0.5
	for y = 1, numRows do
		local cell = {}
		cell.x = x
		cell.y = y
		cell.glyphCycle = randomFloat()
		cell.columnTimeOffset = columnTimeOffset
		cell.columnSpeedOffset = columnSpeedOffset
		cell.glyphIndex = math.random(numGlyphs) + 1
		cell.fadeIndex = -1

		cells[#cells + 1] = cell
		-- glyphMap:setTileAtPosition(x, y, cell.glyphIndex)
	end
end

playdate.display.setRefreshRate(0)
playdate.resetElapsedTime()

function playdate.update()
	local delta
	if playdate.isCrankDocked() then
		speed = math.min(maxSpeed, speed + 0.07)
		delta = playdate.getElapsedTime() * speed
	else
		speed = math.max(minSpeed, speed - 0.07)
		delta = playdate.getElapsedTime() * speed + playdate.getCrankChange() * 2 / 360 -- TODO: tune
	end
	playdate.resetElapsedTime()
	time += delta

	-- local count = 0

	for i = 1, numCells do
		local mustDraw = false
		local cell = cells[i]
		local cellTime = cell.y * -0.03 + cell.columnTimeOffset + time * cell.columnSpeedOffset

		local brightness = math.log((1 - wobble(cellTime) % 1) * 1.25) * 6
		local fadeIndex = math.max(1, math.min(numFades, math.floor(numFades * (1 - brightness))))
		if cell.fadeIndex ~= fadeIndex then
			cell.fadeIndex = fadeIndex
			mustDraw = true
		end

		cell.glyphCycle = cell.glyphCycle + delta * 2
		if cell.glyphCycle > 1 then
			cell.glyphCycle = cell.glyphCycle % 1
			local glyphIndex = (cell.glyphIndex + math.random(math.floor(numGlyphs / 2))) % numGlyphs + 1
			if cell.glyphIndex ~= glyphIndex then
				cell.glyphIndex = glyphIndex
				if fadeIndex < numFades then
					mustDraw = true
				end
			end
		end

		if mustDraw then
			-- count += 1
			-- glyphMap:setTileAtPosition(cell.x, cell.y, cell.glyphIndex)
			-- fadeMap:setTileAtPosition(cell.x, cell.y, cell.fadeIndex)

			glyphs[cell.glyphIndex]:draw((cell.x - 1) * glyphWidth, (cell.y - 1) * glyphWidth)
			fades[cell.fadeIndex]:draw((cell.x - 1) * glyphWidth, (cell.y - 1) * glyphWidth)
		end
	end

	-- print(count / numGlyphs)

	-- gfx.clear()
	-- glyphMap:draw(0, 0)
	-- fadeMap:draw(0, 0)

end

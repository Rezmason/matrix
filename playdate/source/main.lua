local gfx <const> = playdate.graphics

local screenWidth <const> = playdate.display.getWidth()
local screenHeight <const> = playdate.display.getHeight()
local glyphWidth <const> = 20
local numColumns <const> = math.floor(screenWidth / glyphWidth)
local numRows <const> = math.floor(screenHeight / glyphWidth)
local numCells <const> = numColumns * numRows

local numGlyphs <const> = 133
local glyphTable = gfx.imagetable.new('images/matrix')
local glyphs = {}
for i = 1, numGlyphs do
	glyphs[i] = glyphTable[i]
end

local ditherType = gfx.image.kDitherTypeAtkinson
local image = gfx.image.new(glyphWidth, glyphWidth, gfx.kColorBlack)
local numFades <const> = 15
local fades = {}
for i = 1, numFades do
	fades[i] = image:fadedImage(i / numFades, ditherType)
end

local minSpeed <const> = 0.15
local maxSpeed <const> = 1
local time = 0
local speed = maxSpeed

local sqrt2 <const> = math.sqrt(2)
local sqrt5 <const> = math.sqrt(5)
function wobble(x)
	return x + 0.3 * math.sin(sqrt2 * x) + 0.2 * math.sin(sqrt5 * x)
end

local cells = {}
for x = 1, numColumns do
	local columnTimeOffset = math.random() * 1000
	local columnSpeedOffset = math.random() * 0.5 + 0.5
	for y = 1, numRows do
		local cell = {}
		cell.x = x
		cell.y = y
		cell.glyphCycle = math.random()
		cell.columnTimeOffset = columnTimeOffset
		cell.columnSpeedOffset = columnSpeedOffset
		cell.glyphIndex = math.floor(math.random() * numGlyphs) + 1
		cell.fadeIndex = -1

		cells[#cells + 1] = cell
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
			local glyphIndex = (cell.glyphIndex + math.random(20)) % numGlyphs + 1
			if cell.glyphIndex ~= glyphIndex then
				cell.glyphIndex = glyphIndex
				if fadeIndex < numFades then
					mustDraw = true
				end
			end
		end

		if mustDraw then
			glyphs[cell.glyphIndex]:draw((cell.x - 1) * glyphWidth, (cell.y - 1) * glyphWidth)
			fades[cell.fadeIndex]:draw((cell.x - 1) * glyphWidth, (cell.y - 1) * glyphWidth)
		end
	end

end

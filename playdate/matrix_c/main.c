//
//  main.c
//  Matrix Effect
//
//  Created by Rezmason on 6/05/22.
//  Read the LICENSE file if you want to
//

// #include <stdio.h>
#include <stdlib.h>
#include <math.h>

#include "pd_api.h"

typedef struct {
	int x;
	int y;
	int fadeIndex;
	int glyphIndex;
	float glyphCycle;
	float columnSpeedOffset;
	float columnTimeOffset;
} Cell;

typedef struct {
	int width;
	int height;
	int rowBytes;
	int hasMask;
	uint8_t *data;
} BitmapView;

static PlaydateAPI* pd = NULL;

static const int glyphWidth = 20;
static int numColumns;
static int numRows;
static int numCells;

static const int numGlyphs = 133;
static const int numFades = 32;

static const float minSpeed = 0.15;
static const float maxSpeed = 1;
static float time = 0;
static float speed = maxSpeed;

static float sineTable[360];
static float wobbleA;
static float wobbleB;

static LCDBitmap **glyphs = NULL;
static Cell *cells = NULL;

static float randf() {
	return (float)rand() / (float)(RAND_MAX);
}

static BitmapView* getBitmapView(LCDBitmap *bitmap)
{
	BitmapView *bv = pd->system->realloc(NULL, sizeof(BitmapView));
	pd->graphics->getBitmapData(
		bitmap,
		&(bv->width),
		&(bv->height),
		&(bv->rowBytes),
		&(bv->hasMask),
		&(bv->data)
	);

	return bv;
}

static void freeBitmapView(BitmapView *bv)
{
	pd->system->realloc(bv, 0);
}

static void composite(BitmapView *src, BitmapView *dest, int srcX, int srcY, int width, int height, int destX, int destY)
{
	if (height < 0) { srcY -= height; destY -= height; height = -height; }
	if (srcY < 0) { height += srcY; destY += srcY; srcY = 0; }
	if (destY < 0) { height += destY; destY += destY; destY = 0; }
	if (height > src->height - srcY) { height = src->height - srcY; }
	if (height > dest->height - destY) { height = dest->height - destY; }
	if (height == 0) return;

	if (width < 0) { srcX -= width; destX -= width; width = -width; }
	if (srcX < 0) { width += srcX; destX += srcX; srcX = 0; }
	if (destX < 0) { width += destX; destX += destX; destX = 0; }
	if (width > src->width - srcX) { width = src->width - srcX; }
	if (width > dest->width - destX) { width = dest->width - destX; }
	if (width == 0) return;
}

static void logBitmapViewToConsole(BitmapView *bv)
{
	pd->system->logToConsole("bitmap: %i x %i %s", bv->width, bv->height, bv->hasMask ? "transparent" : "");

	int dataSize = bv->rowBytes * bv->height;

	{
		char line[bv->rowBytes * 8 + 1];
		for (int l = 0; l < bv->width; l++) {
			line[l] = (l % 8 == 0) ? '|' : '_';
		}
		for (int l = bv->width; l < bv->rowBytes * 8; l++) {
			line[l] = 'x';
		}
		line[bv->rowBytes * 8] = '\0';

		pd->system->logToConsole("+%s+", line);
	}

	int i = 0;
	for (int y = 0; y < bv->height; y++) {

		char line[bv->rowBytes * 8 + 1];
		for (int l = 0; l < bv->rowBytes * 8; l++) {
			line[l] = ' ';
		}
		line[bv->rowBytes * 8] = '\0';

		int l = 0;
		for (int x = 0; x < bv->rowBytes; x++) {
			int byte = bv->data[i];
			int maskByte = bv->hasMask ? bv->data[i + dataSize] : 0xFF;
			for (int j = 0; j < 8; j++) {
				int bit = (byte >> (7 - j)) & 1;
				int maskBit = (maskByte >> (7 - j)) & 1;
				if (maskBit) {
					line[l] = bit ? '#' : '.';
				} else {
					line[l] = bit ? '?' : ' ';
				}
				l++;
			}
			i++;
		}

		pd->system->logToConsole("[%s]", line);
	}
}

static void init()
{
	srand(pd->system->getSecondsSinceEpoch(NULL));

	wobbleA = sqrt(2) / 50;
	wobbleB = sqrt(5) / 50;

	int screenWidth = pd->display->getWidth();
	int screenHeight = pd->display->getHeight();
	numColumns = screenWidth / glyphWidth;
	numRows = screenHeight / glyphWidth;
	numCells = numColumns * numRows;

	for (int i = 0; i < 360; i++)
	{
		sineTable[i] = sin(M_PI / 180 * i);
	}

	const char *outErr = NULL;
	LCDBitmap *glyphSpritesheet = pd->graphics->loadBitmap("images/matrix-glyphs", &outErr);
	BitmapView *glyphSpritesheetBV = getBitmapView(glyphSpritesheet);

	int spritesheetColumns = floor(glyphSpritesheetBV->width / glyphWidth);

	LCDBitmap *fadeGradient = pd->graphics->loadBitmap("images/fade-gradient", &outErr);
	BitmapView *fadeGradientBV = getBitmapView(fadeGradient);

	glyphs = pd->system->realloc(NULL, sizeof(LCDBitmap *) * numGlyphs * numFades);

	LCDBitmap *glyph = pd->graphics->newBitmap(glyphWidth, glyphWidth, kColorBlack);

	for (int i = 0; i < numGlyphs; i++) {
		int column = i % spritesheetColumns;
		int row = i / spritesheetColumns;
		/*
		pd->graphics.lockFocus(glyph)
		glyphSpritesheet:draw(-column * glyphWidth, -row * glyphWidth)
		pd->graphics.unlockFocus()
		glyphs[i] = {}
		for j = 1, numFades do
			local fade = (j - 1) / (numFades - 1)
			local variant = glyph:copy()
			glyphs[i][j] = variant
			pd->graphics.lockFocus(variant)
			fadeGradient:draw(fade * (glyphWidth - fadeGradient.width), 0)
			pd->graphics.unlockFocus()
		end
		*/
	}

	pd->graphics->drawBitmap(glyphSpritesheet, 0, 20, kBitmapUnflipped);
	pd->graphics->drawBitmap(fadeGradient, 0, 0, kBitmapUnflipped);

	pd->graphics->freeBitmap(glyphSpritesheet);
	freeBitmapView(glyphSpritesheetBV);
	pd->graphics->freeBitmap(fadeGradient);
	freeBitmapView(fadeGradientBV);

	cells = pd->system->realloc(NULL, sizeof(Cell) * numCells);

	int i = 0;
	for (int x = 0; x < numColumns; x++) {
		float columnTimeOffset = randf() * 1000;
		float columnSpeedOffset = random() * 0.5 + 0.5;
		for (int y = 0; y < numRows; y++) {
			Cell *cell = &cells[i];
			i++;

			cell->x = x;
			cell->y = y;
			cell->glyphCycle = random();
			cell->columnTimeOffset = columnTimeOffset;
			cell->columnSpeedOffset = columnSpeedOffset;
			cell->glyphIndex = rand() % numGlyphs;
			cell->fadeIndex = -1;
		}
	}
}

static int update(void* ud)
{
	float delta;
	if (pd->system->isCrankDocked()) {
		speed += 0.07;
		if (speed > maxSpeed) {
			speed = maxSpeed;
		}
		delta = pd->system->getElapsedTime() * speed;
	} else {
		speed -= 0.07;
		if (speed < minSpeed) {
			speed = minSpeed;
		}
		delta = pd->system->getElapsedTime() * speed + pd->system->getCrankChange() * 2 / 360;
	}
	pd->system->resetElapsedTime();
	time += delta;

	for (int i = 0; i < numCells; i++) {
		int mustDraw = 0;
		Cell *cell = &cells[i];

		float cellTime = cell->y * -0.03 + cell->columnTimeOffset + time * cell->columnSpeedOffset;
		float brightness = 4 * fmod(
			cellTime
			+ 0.3 * sineTable[(int)(fmod(wobbleA * cellTime, 360))]
			+ 0.2 * sineTable[(int)(fmod(wobbleB * cellTime, 360))],
			1
		);
		int fadeIndex = brightness * numFades;

		if (fadeIndex < 1) fadeIndex = 1;
		if (fadeIndex > numFades) fadeIndex = numFades;
		if (cell->fadeIndex != fadeIndex) {
			cell->fadeIndex = fadeIndex;
			mustDraw = 1;
		}

		cell->glyphCycle = cell->glyphCycle + delta * 2;
		if (cell->glyphCycle > 1) {
			cell->glyphCycle = fmod(cell->glyphCycle, 1);
			int glyphIndex = (cell->glyphIndex + (rand() % 20)) % numGlyphs;
			if (cell->glyphIndex != glyphIndex) {
				cell->glyphIndex = glyphIndex;
				if (fadeIndex < numFades) {
					mustDraw = 1;
				}
			}
		}

		if (mustDraw) {
			/*
			pd->graphics->drawBitmap(
				glyphs[cell->glyphIndex * numFades + cell->fadeIndex],
				(cell->x - 1) * glyphWidth,
				(cell->y - 1) * glyphWidth,
				kBitmapUnflipped
			);
			*/
		}
	}

	return 1;
}

#ifdef _WINDLL
__declspec(dllexport)
#endif
int eventHandler(PlaydateAPI* playdate, PDSystemEvent event, uint32_t arg)
{
	if ( event == kEventInit )
	{
		pd = playdate;
		pd->display->setRefreshRate(0);
		pd->system->setUpdateCallback(update, NULL);
		init();
		pd->system->resetElapsedTime();
	}

	return 0;
}

//
//  main.c
//  Matrix Effect
//
//  Created by Rezmason on 6/05/22.
//  Read the LICENSE file if you want to
//

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

static PlaydateAPI* pd = NULL;

static const int glyphWidth = 20;
static int numColumns;
static int numRows;
static int numCells;

static const int numStandardGlyphs = 133;
static const int numPDGlyphs = 10;
static const int numTotalGlyphs = numStandardGlyphs + numPDGlyphs;
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

	LCDBitmap *glyphSpritesheet = pd->graphics->loadBitmap("images/matrix-glyphs", NULL);
	int glyphSpritesheetWidth;
	pd->graphics->getBitmapData(glyphSpritesheet, &glyphSpritesheetWidth, NULL, NULL, NULL, NULL);
	int spritesheetColumns = floor(glyphSpritesheetWidth / glyphWidth);

	LCDBitmap *fadeGradient = pd->graphics->loadBitmap("images/fade-gradient", NULL);
	int fadeGradientWidth;
	pd->graphics->getBitmapData(fadeGradient, &fadeGradientWidth, NULL, NULL, NULL, NULL);

	glyphs = pd->system->realloc(NULL, sizeof(LCDBitmap *) * numTotalGlyphs * numFades);

	LCDBitmap *glyph = pd->graphics->newBitmap(glyphWidth, glyphWidth, kColorBlack);

	pd->graphics->pushContext(glyph);
	for (int i = 0; i < numTotalGlyphs; i++) {
		int column = i % spritesheetColumns;
		int row = i / spritesheetColumns;
		pd->graphics->drawBitmap(glyphSpritesheet, -column * glyphWidth, -row * glyphWidth, kBitmapUnflipped);
		for (int j = 0; j < numFades; j++) {
			float fade = j / (numFades - 1.0);
			LCDBitmap *variant = pd->graphics->copyBitmap(glyph);
			glyphs[i * numFades + j] = variant;
			pd->graphics->pushContext(variant);
			pd->graphics->setDrawMode(kDrawModeWhiteTransparent);
			pd->graphics->drawBitmap(fadeGradient, fade * (glyphWidth - fadeGradientWidth), 0, kBitmapUnflipped);
			pd->graphics->popContext();
		}
	}
	pd->graphics->popContext();

	pd->graphics->freeBitmap(glyphSpritesheet);
	pd->graphics->freeBitmap(fadeGradient);

	cells = pd->system->realloc(NULL, sizeof(Cell) * numCells);

	int i = 0;
	for (int x = 0; x < numColumns; x++) {
		float columnTimeOffset = randf() * 1000;
		float columnSpeedOffset = randf() * 0.5 + 0.5;
		for (int y = 0; y < numRows; y++) {
			Cell *cell = &cells[i];
			i++;

			cell->x = x;
			cell->y = y;
			cell->glyphCycle = randf();
			cell->columnTimeOffset = columnTimeOffset;
			cell->columnSpeedOffset = columnSpeedOffset;
			cell->glyphIndex = rand() % numStandardGlyphs;
			cell->fadeIndex = -1;
		}
	}

	pd->graphics->clear(kColorBlack);
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

	PDButtons currentButtons;
	pd->system->getButtonState(&currentButtons, NULL, NULL);
	int addPDGlyphs = currentButtons & kButtonA && currentButtons & kButtonB;

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
		if (fadeIndex < 0) fadeIndex = 0;
		if (fadeIndex >= numFades - 1) fadeIndex = numFades - 1;
		if (cell->fadeIndex != fadeIndex) {
			cell->fadeIndex = fadeIndex;
			mustDraw = 1;
		}

		cell->glyphCycle = cell->glyphCycle + delta * 2;
		if (cell->glyphCycle > 1) {
			cell->glyphCycle = fmod(cell->glyphCycle, 1);
			int lastGlyphIndex = cell->glyphIndex;
			while (cell->glyphIndex == lastGlyphIndex) {
				cell->glyphIndex = rand();
				if (addPDGlyphs && rand() % 4 == 0) {
					cell->glyphIndex = numStandardGlyphs + cell->glyphIndex % numPDGlyphs;
				} else {
					cell->glyphIndex = cell->glyphIndex % numStandardGlyphs;
				}
			}
			if (fadeIndex < numFades - 1) {
				mustDraw = 1;
			}
		}

		if (mustDraw) {
			LCDBitmap *glyph = glyphs[cell->glyphIndex * numFades + cell->fadeIndex];
			pd->graphics->drawBitmap(glyph, cell->x * glyphWidth, cell->y * glyphWidth, kBitmapUnflipped);
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
		pd->display->setRefreshRate(30);
		pd->system->setUpdateCallback(update, NULL);
		init();
		pd->system->resetElapsedTime();
	}

	return 0;
}

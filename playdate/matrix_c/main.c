//
//  main.c
//  Matrix Effect
//
//  Created by Rezmason on 6/05/22.
//  Licensed under MIT. (See the LICENSE file.)
//

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

const struct playdate_sound* snd = NULL;
const struct playdate_display* disp = NULL;
const struct playdate_graphics* gfx = NULL;
const struct playdate_sys* sys = NULL;

static const int glyphWidth = 20;
static int numColumns;
static int numRows;
static int numCells;

static const int numStandardGlyphs = 135;
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

static float randf(void) {
	return (float)rand() / (float)(RAND_MAX);
}

static void init(void)
{
	gfx->clear(kColorBlack);

	srand(sys->getSecondsSinceEpoch(NULL));

	wobbleA = sqrt(2) / 50;
	wobbleB = sqrt(5) / 50;

	int screenWidth = disp->getWidth();
	int screenHeight = disp->getHeight();
	numColumns = screenWidth / glyphWidth;
	numRows = screenHeight / glyphWidth;
	numCells = numColumns * numRows;

	for (int i = 0; i < 360; i++)
	{
		sineTable[i] = sin(M_PI / 180 * i);
	}

	LCDBitmap *glyphSpritesheet = gfx->loadBitmap("images/matrix-glyphs", NULL);
	int glyphSpritesheetWidth;
	gfx->getBitmapData(glyphSpritesheet, &glyphSpritesheetWidth, NULL, NULL, NULL, NULL);
	int spritesheetColumns = floor(glyphSpritesheetWidth / glyphWidth);

	LCDBitmap *fadeGradient = gfx->loadBitmap("images/fade-gradient", NULL);
	int fadeGradientWidth;
	gfx->getBitmapData(fadeGradient, &fadeGradientWidth, NULL, NULL, NULL, NULL);

	glyphs = sys->realloc(NULL, sizeof(LCDBitmap *) * numTotalGlyphs * numFades);

	LCDBitmap *glyph = gfx->newBitmap(glyphWidth, glyphWidth, kColorBlack);

	gfx->pushContext(glyph);
	for (int i = 0; i < numTotalGlyphs; i++) {
		int column = i % spritesheetColumns;
		int row = i / spritesheetColumns;
		gfx->drawBitmap(glyphSpritesheet, -column * glyphWidth, -row * glyphWidth, kBitmapUnflipped);
		for (int j = 0; j < numFades; j++) {
			float fade = j / (numFades - 1.0);
			LCDBitmap *variant = gfx->copyBitmap(glyph);
			glyphs[i * numFades + j] = variant;
			gfx->pushContext(variant);
			gfx->drawBitmap(fadeGradient, fade * (glyphWidth - fadeGradientWidth), 0, kBitmapUnflipped);
			gfx->popContext();
		}
	}
	gfx->popContext();

	gfx->freeBitmap(glyphSpritesheet);
	gfx->freeBitmap(fadeGradient);

	cells = sys->realloc(NULL, sizeof(Cell) * numCells);

	int i = 0;
	for (int x = 0; x < numColumns; x++) {
		float columnTimeOffset = randf() * 1000;
		float columnSpeedOffset = randf() * 0.5f + 0.5f;
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
}

static int update(void* ud)
{
	float delta;
	int currentFadeSkip = 1;

	if (sys->isCrankDocked()) {
		speed += 0.07f;
		if (speed > maxSpeed) {
			speed = maxSpeed;
		}
		delta = sys->getElapsedTime() * speed;
		currentFadeSkip = 6;
	} else {
		speed -= 0.07f;
		if (speed < minSpeed) {
			speed = minSpeed;
		}
		delta = sys->getElapsedTime() * speed + sys->getCrankChange() * 5 / 360;
	}
	sys->resetElapsedTime();
	time += delta;

	int currentNumFades = numFades / currentFadeSkip;

	PDButtons currentButtons;
	sys->getButtonState(&currentButtons, NULL, NULL);
	int addPDGlyphs = currentButtons & kButtonA && currentButtons & kButtonB;

	for (int i = 0; i < numCells; i++) {
		int mustDraw = 0;
		Cell *cell = &cells[i];

		float cellTime = cell->y * -0.03f + cell->columnTimeOffset + time * cell->columnSpeedOffset;
		float brightness = 4 * fmodf(
			cellTime
			+ 0.3f * sineTable[(int)(fmodf(wobbleA * cellTime, 360))]
			+ 0.2f * sineTable[(int)(fmodf(wobbleB * cellTime, 360))],
			1
		);

		int fadeIndex = brightness * currentNumFades;
		fadeIndex *= currentFadeSkip;
		if (fadeIndex < 0) fadeIndex = 0;
		if (fadeIndex >= numFades - 1) fadeIndex = numFades - 1;
		if (cell->fadeIndex != fadeIndex) {
			cell->fadeIndex = fadeIndex;
			mustDraw = 1;
		}

		cell->glyphCycle = cell->glyphCycle + delta * 2;
		if (cell->glyphCycle > 1) {
			cell->glyphCycle = fmodf(cell->glyphCycle, 1);
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
			gfx->drawBitmap(glyph, cell->x * glyphWidth, cell->y * glyphWidth, kBitmapUnflipped);
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
		snd = playdate->sound;
		gfx = playdate->graphics;
		sys = playdate->system;
		disp = playdate->display;

		disp->setRefreshRate(30);
		sys->resetElapsedTime();
		sys->setUpdateCallback(update, NULL);
		init();
	}

	return 0;
}

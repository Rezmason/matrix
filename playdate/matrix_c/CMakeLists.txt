cmake_minimum_required(VERSION 3.14)
set(CMAKE_C_STANDARD 11)

set(ENVSDK $ENV{PLAYDATE_SDK_PATH})

if (NOT ${ENVSDK} STREQUAL "")
	# Convert path from Windows
	file(TO_CMAKE_PATH ${ENVSDK} SDK)
else()
	execute_process(
			COMMAND bash -c "egrep '^\\s*SDKRoot' $HOME/.Playdate/config"
			COMMAND head -n 1
			COMMAND cut -c9-
			OUTPUT_VARIABLE SDK
			OUTPUT_STRIP_TRAILING_WHITESPACE
	)
endif()

if (NOT EXISTS ${SDK})
	message(FATAL_ERROR "SDK Path not found; set ENV value PLAYDATE_SDK_PATH")
	return()
endif()

set(CMAKE_CONFIGURATION_TYPES "Debug;Release")
set(CMAKE_XCODE_GENERATE_SCHEME TRUE)

# Game Name Customization
set(PLAYDATE_GAME_NAME ThePlaytrix)
set(PLAYDATE_GAME_DEVICE ThePlaytrix_DEVICE)

project(${PLAYDATE_GAME_NAME} C ASM)

file(GLOB IMAGES
	"Source/images/*"
)

if (TOOLCHAIN STREQUAL "armgcc")
	add_executable(${PLAYDATE_GAME_DEVICE} ${SDK}/C_API/buildsupport/setup.c main.c)
	target_compile_options(${PLAYDATE_GAME_DEVICE} PUBLIC -Wstrict-prototypes -Wdouble-promotion -Wall -Wpedantic -Wshadow -Wextra -Werror=implicit-int -Werror=incompatible-pointer-types -Werror=int-conversion -Wvla )
else()
	add_library(${PLAYDATE_GAME_NAME} SHARED main.c ${IMAGES})
	target_compile_options(${PLAYDATE_GAME_NAME} PUBLIC -Wstrict-prototypes -Wdouble-promotion -Wall -Wpedantic -Wshadow -Wextra -Werror=implicit-int -Werror=incompatible-pointer-types -Werror=int-conversion -Wvla )
endif()

include(${SDK}/C_API/buildsupport/playdate_game.cmake)


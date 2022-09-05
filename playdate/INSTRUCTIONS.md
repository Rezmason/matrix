C project
  To run in the simulator:
    cd ./build
    rm -R ../ThePlaytrix.pdx ./*
    cmake ..
    make

  To run on the device:
    cd ./build-device
    rm -R ../ThePlaytrix.pdx ./*
    cmake -DCMAKE_TOOLCHAIN_FILE=${PLAYDATE_SDK_PATH}/C_API/buildsupport/arm.cmake -DCMAKE_BUILD_TYPE=Release ..
    make

Lua project
  pdc -s Source ThePlaytrixLua.pdx

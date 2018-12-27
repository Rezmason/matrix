/**
 * @author rezmason
 */

const easeInOutQuad = input => {
  input = Math.max(0, Math.min(1, input));
  if (input < 0.5) {
    return 2 * input * input;
  }
  input -= 1;
  return 1 - 2 * input * input;
}

const ARRAY_SIZE = 2048;

THREE.ColorMapPass = function (entries, ditherMagnitude = 1, graininess = 100) {
  const colors = Array(ARRAY_SIZE).fill().map(_ => new THREE.Vector3(0, 0, 0));
  const sortedEntries = entries.slice().sort((e1, e2) => e1.at - e2.at).map(entry => ({
    color: entry.color,
    arrayIndex: Math.floor(Math.max(Math.min(1, entry.at), 0) * (ARRAY_SIZE - 1))
  }));
  sortedEntries.unshift({color:sortedEntries[0].color, arrayIndex:0});
  sortedEntries.push({color:sortedEntries[sortedEntries.length - 1].color, arrayIndex:ARRAY_SIZE - 1});
  sortedEntries.forEach((entry, index) => {
    colors[entry.arrayIndex].copy(entry.color);
    if (index + 1 < sortedEntries.length) {
      const nextEntry = sortedEntries[index + 1];
      const diff = nextEntry.arrayIndex - entry.arrayIndex;
      for (let i = 0; i < diff; i++) {
        colors[entry.arrayIndex + i].lerpVectors(entry.color, nextEntry.color, i / diff);
      }
    }
  });
  const values = new Uint8Array([].concat(...colors.map(color => color.toArray().map(component => Math.floor(component * 255)))));

  this.dataTexture = new THREE.DataTexture(
    values,
    values.length / 3,
    1,
    THREE.RGBFormat,
    THREE.UnsignedByteType,
    THREE.UVMapping);
  this.dataTexture.magFilter = THREE.LinearFilter;
  this.dataTexture.needsUpdate = true;
  this.graininess = graininess;

  this.shader = {
    uniforms: {
      tDiffuse: { value: null },
      tColorData: { value: this.dataTexture },
      ditherMagnitude: { value: ditherMagnitude },
      tTime: { value: 0 }
    },

    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4( position, 1.0 );
      }
    `,

    fragmentShader: `
      #define PI 3.14159265359

      uniform sampler2D tDiffuse;
      uniform sampler2D tColorData;
      uniform float ditherMagnitude;
      uniform float tTime;
      varying vec2 vUv;

      highp float rand( const in vec2 uv, const in float t ) {
        const highp float a = 12.9898, b = 78.233, c = 43758.5453;
        highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
        return fract(sin(sn) * c + t);
      }

      void main() {
        gl_FragColor = texture2D( tColorData, vec2( texture2D( tDiffuse, vUv ).r - rand( gl_FragCoord.xy, tTime ) * ditherMagnitude, 0.0 ) );
      }
    `
  };

  THREE.ShaderPass.call(this, this.shader);
};

THREE.ColorMapPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {
  constructor: THREE.ColorMapPass,
  render: function() {
    this.uniforms[ "tColorData" ].value = this.dataTexture;
    this.uniforms[ "tTime" ].value = (Date.now() % this.graininess) / this.graininess;
    THREE.ShaderPass.prototype.render.call(this, ...arguments);
  }
});

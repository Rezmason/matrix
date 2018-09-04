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

THREE.ColorMapPass = function (entries, ditherMagnitude = 1) {
  const colors = Array(256).fill().map(_ => new THREE.Vector3());
  const sortedEntries = entries.slice().sort((e1, e2) => e1.at - e2.at).map(entry => ({
    color: entry.color,
    at255: Math.floor(Math.max(Math.min(1, entry.at), 0) * (colors.length - 1))
  }));
  sortedEntries.unshift({color:sortedEntries[0].color, at255:0});
  sortedEntries.push({color:sortedEntries[sortedEntries.length - 1].color, at255:255});
  sortedEntries.forEach((entry, index) => {
    colors[entry.at255].copy(entry.color);
    if (index + 1 < sortedEntries.length) {
      const nextEntry = sortedEntries[index + 1];
      const diff = nextEntry.at255 - entry.at255;
      for (let i = 0; i < diff; i++) {
        colors[entry.at255 + i].lerpVectors(entry.color, nextEntry.color, i / diff);
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

  this.shader = {
    uniforms: {
      tDiffuse: { value: null },
      tColorData: { value: this.dataTexture },
      ditherMagnitude: { value: ditherMagnitude }
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
      varying vec2 vUv;

      highp float rand( const in vec2 uv ) {
        const highp float a = 12.9898, b = 78.233, c = 43758.5453;
        highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
        return fract(sin(sn) * c);
      }

      void main() {
        gl_FragColor = texture2D( tColorData, vec2( texture2D( tDiffuse, vUv ).r - rand( gl_FragCoord.xy ) * ditherMagnitude, 0.0 ) );
      }
    `
  };

  THREE.ShaderPass.call(this, this.shader);
};

THREE.ColorMapPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {
  constructor: THREE.ColorMapPass,
  render: function() {
    this.uniforms[ "tColorData" ].value = this.dataTexture;
    THREE.ShaderPass.prototype.render.call(this, ...arguments);
  }
});

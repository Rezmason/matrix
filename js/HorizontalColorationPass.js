/**
 * @author rezmason
 */

THREE.HorizontalColorationPass = function (colors, ditherMagnitude = 1) {
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
      ditherMagnitude: { value: ditherMagnitude },
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
        float value = texture2D(tDiffuse, vUv).r;
        vec3 value2 = texture2D(tColorData, vUv).rgb - rand( gl_FragCoord.xy ) * ditherMagnitude;
        gl_FragColor = vec4(value2 * value, 1.0);
      }
    `
  };

  THREE.ShaderPass.call(this, this.shader);
};

THREE.HorizontalColorationPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {
  constructor: THREE.HorizontalColorationPass,
  render: function() {
    this.uniforms[ "tColorData" ].value = this.dataTexture;
    THREE.ShaderPass.prototype.render.call(this, ...arguments);
  }
});

/**
 * @author rezmason
 */

THREE.FilmGrainPass = function (blurMagnitude, ditherMagnitude) {
  this.shader = {
    uniforms: {
      tDiffuse: { value: null },
      blurMagnitude: { value: blurMagnitude },
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
      uniform float blurMagnitude;
      uniform float ditherMagnitude;
      varying vec2 vUv;

      highp float rand( const in vec2 uv ) {
        const highp float a = 12.9898, b = 78.233, c = 43758.5453;
        highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
        return fract(sin(sn) * c);
      }

      vec3 dithering( vec3 color1, vec3 color2 ) {
        float difference = pow(length(color1 - color2), 0.1);
        return color1 + vec3( -1, 0.5, 0.5 ) * ditherMagnitude * difference * mix( -1.0, 1.0, rand( gl_FragCoord.xy ) );
      }

      void main() {
        vec4 sample = texture2D( tDiffuse, vUv );
        vec4 blurSum = vec4( 0.0 );

        blurSum += texture2D( tDiffuse, vUv + vec2(-blurMagnitude, -blurMagnitude) ) * 0.25;
        blurSum += texture2D( tDiffuse, vUv + vec2( blurMagnitude, -blurMagnitude) ) * 0.25;
        blurSum += texture2D( tDiffuse, vUv + vec2(-blurMagnitude,  blurMagnitude) ) * 0.25;
        blurSum += texture2D( tDiffuse, vUv + vec2( blurMagnitude,  blurMagnitude) ) * 0.25;

        gl_FragColor = vec4(dithering(blurSum.rgb, sample.rgb), 1.0);
      }
    `
  };

  THREE.ShaderPass.call(this, this.shader);
};

THREE.FilmGrainPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {
  constructor: THREE.FilmGrainPass,
  render: THREE.ShaderPass.prototype.render
});

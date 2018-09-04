/**
 * @author rezmason
 */

THREE.ImageOverlayPass = function (texture) {
  this.texture = texture;
  this.shader = {
    uniforms: {
      tDiffuse: { value: null },
      map: { value: this.texture },
    },

    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4( position, 1.0 );
      }
    `,

    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform sampler2D map;
      varying vec2 vUv;

      void main() {
        gl_FragColor = vec4(texture2D(map, vUv).rgb * (pow(texture2D(tDiffuse, vUv).r, 1.5) * 0.995 + 0.005), 1.0);
      }
    `
  };

  THREE.ShaderPass.call(this, this.shader);
};

THREE.ImageOverlayPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {
  constructor: THREE.ImageOverlayPass,
  render: function() {
    this.uniforms[ "map" ].value = this.texture;
    THREE.ShaderPass.prototype.render.call(this, ...arguments);
  }
});

precision mediump float;
varying vec2 vUV;
uniform float width, height;
uniform float time;
uniform sampler2D tex;
// uniform sampler2D bloomTex;

void main() {

	// gl_FragColor = texture2D(tex, vUV);
	// vec4 color = texture2D(bloomTex, vUV) +  texture2D(tex, vUV);

	vec2 iResolution = vec2(width,height);
	vec2 cp = -1.0 + 2.0 * gl_FragCoord.xy / iResolution.xy;
	float cl = length(cp);
    vec2 uv = gl_FragCoord.xy / iResolution.xy + (cp / cl / 10.) * cos(cl * 1.0 - time * 5.0) * 0.8;
	// vec4 col=smoothstep(0.1,.91,texture2D(color).xyz);
	
	vec3 col = texture2D(tex, uv).xyz;// + texture2D(bloomTex, uv).xyz;;



	gl_FragColor = vec4(col,1.0);
}

// void main( out vec4 fragColor, in vec2 fragCoord )
// {
//     vec2 cp = -1.0 + 2.0 * fragCoord / iResolution.xy;
//     float cl = length(cp);
//     vec2 uv = fragCoord / iResolution.xy + (cp / cl) * cos(cl * 12.0 - iTime * 4.0) * 0.02;
//     vec3 col = texture(iChannel0, uv).xyz;
//     fragColor = vec4(col, 1.0);
// }
precision mediump float;
varying vec2 vUV;
uniform float width, height;
uniform float time;
uniform float intensity;
uniform float centerW;
uniform float centerH;
uniform sampler2D tex;
uniform sampler2D bloomTex;

void main() {

	// gl_FragColor = texture2D(tex, vUV);
	// vec4 color = texture2D(bloomTex, vUV) +  texture2D(tex, vUV);

	// float intensity = 0.1;


	vec2 iResolution = vec2(height,width);
	//vec2 cp = -1. + 2. * gl_FragCoord.xy / iResolution.xy;
	//cp = -1. + 2. * vec2(centerW, centerH) / iResolution.xy;
	vec2 cp = vec2(
		-1. + 2.* gl_FragCoord.x /iResolution.x + -1.+ 2.*(iResolution.x-centerW)/iResolution.x,
		-1. + 2.* gl_FragCoord.y /iResolution.y//gl_FragCoord.y //-1. + 2.*(gl_FragCoord.y)/iResolution.y + -1.+ 2.*(iResolution.y-centerH)/iResolution.y
	);
	// cp.y = 1. - cp.y - 2. * centerH/iResolution.y;
	

	float cl = length(cp);

    vec2 uv = gl_FragCoord.xy / iResolution.xy + (cp / cl / 4. ) * sin(cl*10. - time * 12.) * intensity*.5;
	// vec4 col=smoothstep(0.1,.91,texture2D(color).xyz);
	
	vec3 col = texture2D(tex, uv).xyz + texture2D(bloomTex, uv).xyz;;



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
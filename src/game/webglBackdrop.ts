export interface WebGLBackdrop {
  resize: (width: number, height: number, dpr: number) => void;
  render: (time: number, biomeHue: number, chaos: number) => void;
  destroy: () => void;
}

const vertexSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentSource = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_hue;
  uniform float u_chaos;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p = p * 2.04 + 11.3;
      amplitude *= 0.5;
    }
    return value;
  }

  vec3 hueToRgb(float h) {
    vec3 k = vec3(0.0, 4.0, 2.0);
    return clamp(abs(mod(h * 6.0 + k, 6.0) - 3.0) - 1.0, 0.0, 1.0);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    float time = u_time * 0.00008;

    vec3 midnight = vec3(0.012, 0.018, 0.055);
    vec3 abyss = vec3(0.035, 0.035, 0.12);
    vec3 color = mix(midnight, abyss, smoothstep(-0.8, 0.85, p.y));

    vec3 biome = hueToRgb(u_hue);
    float cloud = fbm(p * 2.1 + vec2(time * 1.7, -time));
    float cloudBand = smoothstep(0.47, 0.78, cloud);
    float ribbon = sin((p.x + p.y * 0.32) * 5.0 + time * 18.0 + cloud * 3.0);
    ribbon = smoothstep(0.28, 0.95, ribbon) * smoothstep(0.18, 0.78, cloud);
    color += biome * cloudBand * 0.13;
    color += mix(vec3(0.05, 0.34, 0.7), biome, 0.55) * ribbon * 0.14;

    vec2 starGrid = gl_FragCoord.xy / 2.5;
    vec2 cell = floor(starGrid / 44.0);
    vec2 local = fract(starGrid / 44.0) - 0.5;
    vec2 starPos = vec2(hash(cell), hash(cell + 8.7)) - 0.5;
    float star = smoothstep(0.055, 0.0, length(local - starPos));
    float twinkle = 0.55 + 0.45 * sin(u_time * 0.0015 + hash(cell) * 18.0);
    color += vec3(0.55, 0.78, 1.0) * star * twinkle;

    float chaosGlow = exp(-length(p - vec2(0.0, -0.1)) * 1.5) * u_chaos;
    color += vec3(0.42, 0.015, 0.08) * chaosGlow;

    float vignette = smoothstep(1.2, 0.25, length(p));
    color *= 0.62 + 0.38 * vignette;
    color = pow(color, vec3(0.88));
    gl_FragColor = vec4(color, 1.0);
  }
`;

const compileShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create WebGL shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const detail = gl.getShaderInfoLog(shader) || 'Unknown shader error';
    gl.deleteShader(shader);
    throw new Error(detail);
  }
  return shader;
};

const createNoopBackdrop = (): WebGLBackdrop => ({
  resize: () => undefined,
  render: () => undefined,
  destroy: () => undefined,
});

export const createWebGLBackdrop = (canvas: HTMLCanvasElement): WebGLBackdrop => {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
  if (!gl) return createNoopBackdrop();

  try {
    const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error('Unable to create WebGL program');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Unable to link WebGL program');

    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Unable to create WebGL buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, 'a_position');
    const resolution = gl.getUniformLocation(program, 'u_resolution');
    const time = gl.getUniformLocation(program, 'u_time');
    const hue = gl.getUniformLocation(program, 'u_hue');
    const chaos = gl.getUniformLocation(program, 'u_chaos');

    return {
      resize(width, height, dpr) {
        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        gl.viewport(0, 0, canvas.width, canvas.height);
      },
      render(now, biomeHue, chaosLevel) {
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        gl.uniform2f(resolution, canvas.width, canvas.height);
        gl.uniform1f(time, now);
        gl.uniform1f(hue, ((biomeHue % 360) + 360) % 360 / 360);
        gl.uniform1f(chaos, Math.max(0, Math.min(1, chaosLevel)));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      destroy() {
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
      },
    };
  } catch {
    return createNoopBackdrop();
  }
};

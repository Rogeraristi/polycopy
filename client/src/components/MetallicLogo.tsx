import React, { useRef, useEffect } from 'react';

// This component uses a canvas and a fragment shader to create a metallic paint effect over your logo image.
// It requires your logo to be a transparent PNG for best results.

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0, 1);
  }
`;

// A simple metallic paint fragment shader (GLSL)
const fragmentShaderSource = `
  precision mediump float;
  varying vec2 v_uv;
  uniform sampler2D u_image;
  uniform float u_time;
  void main() {
    vec2 uv = v_uv;
    float metallic = 0.5 + 0.5 * sin(u_time + uv.x * 10.0 + uv.y * 10.0);
    vec4 color = texture2D(u_image, uv);
    float fresnel = pow(1.0 - dot(uv - 0.5, uv - 0.5) * 4.0, 2.0);
    color.rgb += metallic * 0.4 + fresnel * 0.3;
    gl_FragColor = color;
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile error');
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Program link error');
  }
  return program;
}

interface MetallicLogoProps {
  src?: string;
  size?: number;
  animated?: boolean;
}

export default function MetallicLogo({ src = '/polycopy-logo.png', size = 64, animated = false }: MetallicLogoProps) {
  if (!animated) {
    return (
      <img
        src={src}
        alt="logo"
        loading="lazy"
        referrerPolicy="no-referrer"
        className="rounded-full object-cover"
        style={{ width: size, height: size, display: 'block' }}
      />
    );
  }

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const shouldAnimateRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    shouldAnimateRef.current = !reducedMotion;

    // Render at device pixel ratio for crispness
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    let intersectionObserver: IntersectionObserver | null = null;
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          shouldAnimateRef.current = Boolean(entry?.isIntersecting) && !reducedMotion;
        },
        { threshold: 0.01 }
      );
      intersectionObserver.observe(canvas);
    }

    const gl = canvas.getContext('webgl');
    if (!gl) {
      intersectionObserver?.disconnect();
      return;
    }

    // Setup shaders and program
    const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
    gl.useProgram(program);

    // Setup geometry
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1, 1, 1
    ]), gl.STATIC_DRAW);
    const aPosition = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    // Load image as texture
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.src = src;
    image.onload = () => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);

      // Animation loop with smoother timing and easing
      let lastTime = 0;
      function render(time: number) {
        if (!shouldAnimateRef.current) {
          animationRef.current = requestAnimationFrame(render);
          return;
        }
        // Use high precision delta for smoothness
        const delta = (time - lastTime) * 0.001;
        lastTime = time;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // Use an eased time for metallic effect
        const easedTime = Math.sin(time * 0.001) * 0.5 + 0.5;
        gl.uniform1f(gl.getUniformLocation(program, 'u_time'), easedTime * time * 0.001);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        animationRef.current = requestAnimationFrame(render);
      }
      animationRef.current = requestAnimationFrame(render);
    };
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      intersectionObserver?.disconnect();
    };
  }, [src, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        display: 'block',
        background: '#000', // Black background for black mscreen effect
        borderRadius: '50%',
      }}
    />
  );
}

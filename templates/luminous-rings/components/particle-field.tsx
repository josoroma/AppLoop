"use client";

import { useEffect, useRef } from "react";

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const gl = canvas.getContext("webgl", { antialias: true, alpha: true });

    if (!gl) return;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) return;

    gl.shaderSource(
      vertexShader,
      `
      attribute vec2 a_position;

      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `,
    );
    gl.shaderSource(
      fragmentShader,
      `
      precision highp float;

      uniform vec2 u_resolution;
      uniform float u_time;

      mat2 rotate2d(float angle) {
        float s = sin(angle);
        float c = cos(angle);
        return mat2(c, -s, s, c);
      }

      float ringLaser(vec2 point, float radius, float width, float startAngle, float arcLength) {
        float dist = length(point);
        float ring = smoothstep(width, 0.0, abs(dist - radius));
        float angle = atan(point.y, point.x);
        float sweep = abs(atan(sin(angle - startAngle), cos(angle - startAngle)));
        float arc = smoothstep(arcLength, arcLength - 0.08, sweep);
        return ring * arc;
      }

      float fullRing(vec2 point, float radius, float width) {
        return smoothstep(width, 0.0, abs(length(point) - radius));
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
        vec2 center = uv - vec2(0.22, -0.02);
        center.x *= 0.78;
        center.y *= 1.18;

        vec2 slow = rotate2d(u_time * 0.18) * center;
        vec2 fast = rotate2d(-u_time * 0.34) * center;
        vec2 counter = rotate2d(u_time * 0.52) * center;

        vec3 color = vec3(0.0);
        float glow = 0.0;

        for (int i = 0; i < 18; i++) {
          float fi = float(i);
          float radius = 0.42 + fi * 0.029;
          float width = 0.0032 + 0.0012 * sin(fi * 1.7);
          float phase = u_time * (0.44 + fi * 0.013) + fi * 0.54;
          float arcLength = 2.22 + 0.42 * sin(u_time * 0.21 + fi);

          float blueArc = ringLaser(slow, radius, width, phase, arcLength);
          float pinkArc = ringLaser(fast, radius + 0.014, width * 1.15, -phase * 0.9, arcLength * 0.78);
          float whiteArc = ringLaser(counter, radius + 0.026, width * 0.72, phase * 1.25 + 1.7, arcLength * 0.42);
          float halo = fullRing(center, radius + 0.006, width * 5.4) * 0.045;

          vec3 blue = vec3(0.14, 0.42, 1.0);
          vec3 pink = vec3(1.0, 0.14, 0.58);
          vec3 purple = vec3(0.58, 0.26, 1.0);
          vec3 white = vec3(0.82, 0.92, 1.0);

          color += blue * blueArc * 1.6;
          color += pink * pinkArc * 1.45;
          color += white * whiteArc * 1.25;
          color += purple * halo;
          glow += blueArc + pinkArc + whiteArc + halo;
        }

        float vignette = smoothstep(1.08, 0.16, length(uv));
        vec3 background = mix(vec3(0.005, 0.008, 0.018), vec3(0.015, 0.025, 0.045), vignette);
        vec3 finalColor = background + color;

        gl_FragColor = vec4(finalColor, min(1.0, 0.22 + glow));
      }
    `,
    );
    gl.compileShader(vertexShader);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();

    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, "a_position");
    const resolution = gl.getUniformLocation(program, "u_resolution");
    const time = gl.getUniformLocation(program, "u_time");

    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let frameId = 0;

    const render = (now: number) => {
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      gl.uniform2f(resolution, width, height);
      gl.uniform1f(time, now * 0.001);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="particle-canvas homepage-laser-rings-canvas" data-builder-id="homepage-laser-rings-canvas" />;
}

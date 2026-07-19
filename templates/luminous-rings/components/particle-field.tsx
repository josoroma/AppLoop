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
        float arc = smoothstep(arcLength, arcLength - 0.055, sweep);
        return ring * arc;
      }

      float fullRing(vec2 point, float radius, float width) {
        return smoothstep(width, 0.0, abs(length(point) - radius));
      }

      float spokeLaser(vec2 point, float angle, float thickness) {
        vec2 dir = vec2(cos(angle), sin(angle));
        float radial = dot(point, dir);
        float lateral = abs(point.x * dir.y - point.y * dir.x);
        return smoothstep(thickness, 0.0, lateral) * smoothstep(-0.18, 0.1, radial) * smoothstep(0.96, 0.22, radial);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
        vec2 center = uv;
        center.x *= 0.92;
        center.y *= 1.06;

        vec2 slow = rotate2d(u_time * 0.32) * center;
        vec2 fast = rotate2d(-u_time * 0.56) * center;
        vec2 counter = rotate2d(u_time * 0.78) * center;
        vec2 whiteSpin = rotate2d(-u_time * 1.05) * center;

        vec3 color = vec3(0.0);
        float glow = 0.0;

        for (int i = 0; i < 26; i++) {
          float fi = float(i);
          float radius = 0.16 + fi * 0.027;
          float width = 0.0024 + 0.0011 * sin(fi * 1.73);
          float phase = u_time * (0.72 + fi * 0.018) + fi * 0.58;
          float arcLength = 1.02 + 0.46 * sin(u_time * 0.28 + fi * 0.7);

          float baseRing = fullRing(center, radius, width * 2.25);
          float blueArc = ringLaser(slow, radius, width, phase, arcLength);
          float pinkArc = ringLaser(fast, radius + 0.009, width * 1.1, -phase * 0.95, arcLength * 0.86);
          float purpleArc = ringLaser(counter, radius + 0.018, width * 1.28, phase * 1.17 + 1.9, arcLength * 0.72);
          float whiteArc = ringLaser(whiteSpin, radius + 0.026, width * 0.82, -phase * 1.34 + 2.8, arcLength * 0.44);
          float halo = fullRing(center, radius + 0.004, width * 8.0) * 0.035;

          vec3 blue = vec3(0.08, 0.46, 1.0);
          vec3 pink = vec3(1.0, 0.08, 0.62);
          vec3 purple = vec3(0.62, 0.18, 1.0);
          vec3 white = vec3(0.92, 0.97, 1.0);

          vec3 ringColor = mix(blue, pink, smoothstep(0.0, 25.0, fi));
          ringColor = mix(ringColor, purple, 0.45 + 0.35 * sin(fi * 1.2));

          color += ringColor * baseRing * 0.28;
          color += blue * blueArc * 2.2;
          color += pink * pinkArc * 2.0;
          color += purple * purpleArc * 1.85;
          color += white * whiteArc * 1.8;
          color += purple * halo;
          glow += blueArc + pinkArc + purpleArc + whiteArc + halo + baseRing * 0.18;
        }

        for (int j = 0; j < 12; j++) {
          float fj = float(j);
          float angle = u_time * (0.72 + fj * 0.04) + fj * 0.5235987756;
          float ray = spokeLaser(center, angle, 0.0028) * 0.16;
          vec3 rayColor = mix(vec3(0.12, 0.5, 1.0), vec3(1.0, 0.12, 0.68), mod(fj, 2.0));
          color += rayColor * ray;
          glow += ray;
        }

        float core = smoothstep(0.32, 0.0, length(center));
        color += vec3(0.45, 0.18, 1.0) * core * 0.32;

        float vignette = smoothstep(1.12, 0.12, length(uv));
        vec3 background = mix(vec3(0.002, 0.003, 0.012), vec3(0.015, 0.018, 0.038), vignette);
        vec3 finalColor = background + color;

        gl_FragColor = vec4(finalColor, min(1.0, 0.18 + glow * 0.85));
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

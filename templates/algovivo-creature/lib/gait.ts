import { creatureMeta } from './creature-mesh'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/**
 * Locomotion comes from the pretrained MLP walking policy driving the original
 * quadruped muscles [0..POLICY_MUSCLE_COUNT). This helper only animates the
 * appended cat-tail muscles with a gentle sway.
 *
 * Mutates `activations` (the live system.a array, already written by the
 * policy this tick) in place and returns it.
 *
 * Anchor muscles (first `tail_anchor_count`) are pinned at exactly 1 so the
 * tail never contracts away from the body and detaches.
 */
export function applyTailSway(activations: number[], timeSeconds: number): number[] {
  const trunk = creatureMeta.trunk_muscles
  const anchors = creatureMeta.tail_anchor_count
  const phase = timeSeconds * 2.2

  trunk.forEach((muscleIndex, i) => {
    if (i < anchors) {
      activations[muscleIndex] = 1
      return
    }
    const t = i / Math.max(trunk.length - 1, 1)
    const wave = Math.sin(phase + t * 1.4)
    // Near rest length: sway without pulling the tail off the rump.
    activations[muscleIndex] = clamp(0.96 + 0.04 * wave * (0.3 + t * 0.7), 0.9, 1)
  })

  return activations
}

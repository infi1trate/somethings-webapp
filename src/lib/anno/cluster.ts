// OVERLAP CLUSTERING — R17.
//
// ═══ THIS IS AN ACCESSIBILITY MECHANISM, NOT A TIDYING ONE ═══
//
// Two comments on the same anchor with the same offsets resolve to the SAME
// point. Measured in anno-07: a 0px centre-to-centre gap, which means the pin
// painted second completely covers the first — one comment becomes unreachable by
// pointer, with nothing on screen to say it is there.
//
// SC 2.5.8 gives two ways to be conformant: a target at least 24×24, or an
// undersized target with 24px of clearance around it. A pin satisfies the first
// on its own — but two pins stacked at the same coordinates defeat the point of
// the criterion, because the covered one has no reachable area at all. So
// clustering is what makes the layer conformant in the multi-comment case, and it
// carries a hard guarantee:
//
//   EVERY EXPANDED MEMBER'S CENTRE IS AT LEAST `separation` FROM EVERY OTHER
//   MEMBER'S CENTRE, AND FROM THE CLUSTER'S OWN COLLAPSE CONTROL.
//
// `separation` is set by the caller to `max(24, pin size + gap)`, so the result
// clears the criterion's 24px AND is wide enough that the discs do not visually
// touch. `fanOut` proves it arithmetically rather than by eye — see the tests.
//
// ═══ WHY THIS FILE IS PURE ═══
//
// `vitest.config.ts` is node-only by an explicit decision, so nothing that
// touches the DOM can be tested here. Geometry does not need a DOM. Keeping the
// clustering rule and the fan-out arithmetic out of the component means the part
// with the accessibility guarantee in it is the part that has tests — which is
// the opposite of how anno-mvp-1 went.

/** The minimum a cluster needs to know about a pin: where it is. */
export type Clusterable = { readonly id: string; readonly x: number; readonly y: number };

export type Cluster<T extends Clusterable> = {
  /** Stable across renders: the ids of the members, sorted. A cluster's identity
   *  is its membership, not its index — an index would reassign the expanded
   *  cluster to a different group the moment a comment is added or resolved. */
  readonly key: string;
  /** The collapse control's position: the arithmetic mean of the members. */
  readonly x: number;
  readonly y: number;
  readonly members: readonly T[];
};

/** ═══ GREEDY, IN A DEFINED ORDER — SO IT IS DETERMINISTIC ═══
 *
 *  Single pass: each item joins the first cluster whose current centre is within
 *  `radius`, otherwise starts its own. Greedy centroid clustering is
 *  order-dependent, which for a visual grouping is fine as long as the order is
 *  fixed — two browsers showing the same comments must group them identically or
 *  a reviewer saying "the cluster of three" means nothing. So the caller's array
 *  order IS the rule, and the layer feeds it in comment-number order.
 *
 *  NOT k-means, not hierarchical: the input is a handful of pins in a viewport,
 *  and a stable answer matters far more than an optimal one. */
export function clusterByProximity<T extends Clusterable>(
  items: readonly T[],
  radius: number
): Cluster<T>[] {
  const groups: { x: number; y: number; members: T[] }[] = [];

  for (const item of items) {
    const hit = groups.find(
      (g) => Math.hypot(g.x - item.x, g.y - item.y) <= radius
    );
    if (hit) {
      hit.members.push(item);
      /* Recentre on every join. A cluster's centre has to be the middle of what
         it contains, or the collapse control ends up sitting on top of one of its
         own members — which is the overlap this exists to remove. */
      hit.x = hit.members.reduce((s, m) => s + m.x, 0) / hit.members.length;
      hit.y = hit.members.reduce((s, m) => s + m.y, 0) / hit.members.length;
    } else {
      groups.push({ x: item.x, y: item.y, members: [item] });
    }
  }

  return groups.map((g) => ({
    key: g.members.map((m) => m.id).sort().join("|"),
    x: g.x,
    y: g.y,
    members: g.members,
  }));
}

/** The offsets an expanded cluster's members take, relative to its centre.
 *
 *  ═══ THE RADIUS IS DERIVED FROM THE SEPARATION, NOT PICKED ═══
 *
 *  Members sit on a circle. For `n` points evenly spaced on a circle of radius
 *  `r`, the distance between ADJACENT points is `2·r·sin(π/n)` — and adjacent is
 *  the closest any pair gets, so satisfying it satisfies all pairs. Requiring
 *  that to be at least `separation` gives:
 *
 *      r ≥ (separation / 2) / sin(π / n)
 *
 *  The radius is also floored at `separation` itself, which is what keeps the
 *  centre's collapse control clear of the ring — centre-to-member distance is
 *  exactly `r`.
 *
 *  So one formula guarantees both distances, and it degrades sensibly: two
 *  members go opposite each other, six sit at the points of a hexagon, and a
 *  larger cluster simply opens wider rather than crowding.
 *
 *  STARTS AT THE TOP and goes clockwise. A fixed start angle means the same
 *  cluster fans out the same way every time, so a reviewer who expands it twice
 *  finds comment 7 in the same place. */
export function fanOut(
  count: number,
  separation: number
): { dx: number; dy: number }[] {
  if (count <= 0) return [];
  if (count === 1) return [{ dx: 0, dy: 0 }];

  const radius = Math.max(separation, separation / 2 / Math.sin(Math.PI / count));

  return Array.from({ length: count }, (_, i) => {
    // -90° puts the first member directly above the centre.
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return {
      dx: Math.round(radius * Math.cos(angle) * 100) / 100,
      dy: Math.round(radius * Math.sin(angle) * 100) / 100,
    };
  });
}

/** The smallest centre-to-centre distance in a fanned-out cluster, including the
 *  distance to the centre control. Exported so the guarantee can be ASSERTED by
 *  a test rather than trusted, and so a caller can log what it achieved. */
export function minSeparation(offsets: readonly { dx: number; dy: number }[]): number {
  if (offsets.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < offsets.length; i++) {
    // To the centre control at (0, 0).
    min = Math.min(min, Math.hypot(offsets[i].dx, offsets[i].dy));
    for (let j = i + 1; j < offsets.length; j++) {
      min = Math.min(
        min,
        Math.hypot(offsets[i].dx - offsets[j].dx, offsets[i].dy - offsets[j].dy)
      );
    }
  }
  return min;
}

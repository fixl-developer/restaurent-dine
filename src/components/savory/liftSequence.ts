// Cue points for the tasting views and the animated lift.
export const duration = 38;

export const chapters = [
  { at: 0, preview: 1, title: "The bowl", detail: "Start at the rim. Sesame seeds and green scallions sit on loose coils of wheat noodles." },
  { at: 5, preview: 9, title: "Gather", detail: "The chopsticks dip into the center. A small bundle gathers at the tips while its ends still rest in the bowl." },
  { at: 11, preview: 19, title: "Lift", detail: "Follow the lowest strands. They uncoil and hang longer as the chopsticks clear the rim." },
  { at: 26, preview: 29, title: "Up close", detail: "At the top of the lift, look along the ridges. The chili oil catches the light between folds of noodle." },
  { at: 32, preview: 37, title: "Settle", detail: "The chopsticks ease back toward the bowl. The trailing ends meet the noodles first." },
];

// Camera scale, vertical position of the chopsticks, tilt, and length below the grip.
const poses = [
  { at: 0, zoom: 1, y: 23, tilt: 4, length: .84 },
  { at: 4, zoom: 1.09, y: 23, tilt: 4, length: .84 },
  { at: 8, zoom: 1.13, y: 39, tilt: 8, length: .76 },
  { at: 10, zoom: 1.14, y: 38, tilt: 5, length: .78 },
  { at: 15, zoom: 1.09, y: 27, tilt: 2, length: .92 },
  { at: 19, zoom: 1.12, y: 8, tilt: 0, length: 1.06 },
  { at: 23, zoom: 1.10, y: -2, tilt: -2, length: 1.13 },
  { at: 26, zoom: 1.11, y: -7, tilt: -4, length: 1.16 },
  { at: 29, zoom: 1.38, y: -5, tilt: -2, length: 1.14 },
  { at: 32, zoom: 1.38, y: -5, tilt: -2, length: 1.14 },
  { at: 35, zoom: 1.12, y: 15, tilt: 2, length: .94 },
  { at: 38, zoom: 1, y: 23, tilt: 4, length: .84 },
];

export function poseAt(time: number) {
  const next = poses.findIndex(pose => pose.at > time);
  if (next < 1) return next < 0 ? poses[poses.length - 1] : poses[0];
  const a = poses[next - 1], b = poses[next];
  const t = (time - a.at) / (b.at - a.at);
  const eased = t * t * (3 - 2 * t);
  const blend = (from: number, to: number) => from + (to - from) * eased;
  return { zoom: blend(a.zoom,b.zoom), y: blend(a.y,b.y), tilt: blend(a.tilt,b.tilt), length: blend(a.length,b.length) };
}

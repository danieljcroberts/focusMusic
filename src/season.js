// The season from the month, northern hemisphere: 0 spring (Mar–May), 1 summer (Jun–Aug), 2 autumn (Sep–Nov), 3 winter (Dec–Feb).
export const season = (d = new Date()) => { const m = d.getMonth(); return m <= 1 || m === 11 ? 3 : m <= 4 ? 0 : m <= 7 ? 1 : 2; };
export const isWinter = () => season() === 3;

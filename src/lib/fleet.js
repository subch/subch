import fleet from '../data/rc-fleet.json';

export const STATUS_LABELS = fleet.statusLabels;

/** All vehicles, runners first, then alphabetical. */
export function allVehicles() {
  const order = ['runner', 'project', 'shelf', 'parts', 'retired'];
  return [...fleet.vehicles].sort((a, b) => {
    const d = order.indexOf(a.status) - order.indexOf(b.status);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });
}

export function getVehicle(slug) {
  return fleet.vehicles.find((v) => v.slug === slug);
}

/** True when a value is worth rendering (not empty string / null / empty array). */
export function has(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

/** Join non-empty parts with a separator — e.g. make + model. */
export function join(parts, sep = ' ') {
  return parts.filter(has).join(sep);
}

export function statusLabel(status) {
  return STATUS_LABELS[status] ?? status ?? 'Unknown';
}

export function coverPhoto(v) {
  return v.photos?.find((p) => has(p?.src))?.src ?? null;
}

/**
 * Flatten a vehicle into labelled spec groups for the build sheet.
 * Every row is emitted even when empty so the page doubles as a
 * checklist of what still needs filling in.
 */
export function specGroups(v) {
  const motor = v.power?.motor ?? {};
  const esc = v.power?.esc ?? {};
  const gearing = v.power?.gearing ?? {};
  const servo = v.electronics?.servo ?? {};
  const chassis = v.chassis ?? {};
  const running = v.running ?? {};

  return [
    {
      title: 'Chassis',
      rows: [
        ['Platform', join([chassis.make, chassis.model])],
        ['Drivetrain', chassis.drivetrain],
        ['Material', chassis.material],
        ['Notes', chassis.notes],
      ],
    },
    {
      title: 'Motor',
      rows: [
        ['Motor', join([motor.make, motor.model])],
        ['Type', motor.type],
        ['kV', has(motor.kv) ? `${motor.kv} kV` : ''],
        ['Turns', has(motor.turns) ? `${motor.turns}T` : ''],
        ['Notes', motor.notes],
      ],
    },
    {
      title: 'ESC',
      rows: [
        ['ESC', join([esc.make, esc.model])],
        ['Cell range', esc.cells],
        ['Current rating', esc.currentRating],
        ['Sensored', has(esc.sensored) ? (esc.sensored ? 'Yes' : 'No') : ''],
        ['Notes', esc.notes],
      ],
    },
    {
      title: 'Gearing',
      rows: [
        ['Pinion', has(gearing.pinion) ? `${gearing.pinion}T` : ''],
        ['Spur', has(gearing.spur) ? `${gearing.spur}T` : ''],
        ['Internal ratio', gearing.internalRatio],
        ['Final drive', gearing.finalDriveRatio],
        ['Rollout', gearing.rollout],
      ],
    },
    {
      title: 'Radio & Steering',
      rows: [
        ['Servo', join([servo.make, servo.model])],
        ['Torque', has(servo.torqueKgCm) ? `${servo.torqueKgCm} kg-cm` : ''],
        ['Servo type', servo.type],
        ['Transmitter', v.electronics?.transmitter],
        ['Receiver', v.electronics?.receiver],
        ['Telemetry', v.electronics?.telemetry],
      ],
    },
    {
      title: 'Running Gear',
      rows: [
        ['Tires', running.tires],
        ['Wheels', running.wheels],
        ['Shocks', running.shocks],
        ['Springs', running.springs],
        ['Body', running.body],
        ['Notes', running.notes],
      ],
    },
  ];
}

export function batteryRows(v) {
  return (v.power?.batteries ?? []).map((b) => ({
    pack: join([b.cells, b.chemistry]) || 'Pack',
    capacity: has(b.capacityMah) ? `${b.capacityMah} mAh` : '',
    cRating: b.cRating,
    connector: b.connector,
    notes: b.notes,
  }));
}

/** Rough completeness score so the fleet page can show what still needs specs. */
export function completeness(v) {
  const rows = specGroups(v).flatMap((g) => g.rows);
  const filled = rows.filter(([, value]) => has(value)).length;
  return { filled, total: rows.length, pct: Math.round((filled / rows.length) * 100) };
}

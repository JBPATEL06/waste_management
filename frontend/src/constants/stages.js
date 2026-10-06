// UI display configuration and constants for the 4 lifecycle stages
// No mock users, sample data, or fake identifiers are stored here.

export const STAGE_CONFIG = {
  collection: {
    roleKey: 'COLLECTION',
    roleLabel: 'Collection',
    prefix: '/collection',
    badgeClass: 'bg-badge-collected-bg text-badge-collected-text',
    stageNumber: 1,
    stageTitle: 'Collection Manifest Intake',
    ownStageTitle: 'Collection Manifest',
    queueSubtitle: 'Manage assigned batches awaiting collection, pending verification, and submitted manifests.',
    kpiLabels: {
      ready: 'Ready',
      locked: 'Locked',
      submitted: 'Submitted',
    },
    kpiSubtitles: {
      ready: 'Action needed',
      locked: 'Waiting assignment',
      submitted: 'Completed entries',
    },
  },
  transportation: {
    roleKey: 'TRANSPORTATION',
    roleLabel: 'Transportation',
    prefix: '/transportation',
    badgeClass: 'bg-badge-transit-bg text-badge-transit-text',
    stageNumber: 2,
    stageTitle: 'Transportation Dispatch Log',
    ownStageTitle: 'Transportation Manifest',
    queueSubtitle: 'Manage outbound and transit batches awaiting dispatch, route transit, and RTS arrivals.',
    kpiLabels: {
      ready: 'Ready for Dispatch',
      locked: 'Locked (Waiting Collection)',
      submitted: 'In-Transit / Arrived',
    },
    kpiSubtitles: {
      ready: 'Ready for dispatch',
      locked: 'Waiting collection',
      submitted: 'Dispatched / In-Transit',
    },
  },
  rts: {
    roleKey: 'RTS',
    roleLabel: 'RTS',
    prefix: '/rts',
    badgeClass: 'bg-badge-rts-bg text-badge-rts-text',
    stageNumber: 3,
    stageTitle: 'RTS Intake & Weighbridge',
    ownStageTitle: 'RTS Intake Manifest',
    queueSubtitle: 'Manage arriving transit batches, weighbridge scale verification, and transfer allocations.',
    kpiLabels: {
      ready: 'Ready for Weighing',
      locked: 'Locked (Waiting Transit)',
      submitted: 'Weighed & Handed Over',
    },
    kpiSubtitles: {
      ready: 'Awaiting arrival scale',
      locked: 'Waiting transit completion',
      submitted: 'Weighed & Handed Over',
    },
  },
  processing: {
    roleKey: 'PROCESSING',
    roleLabel: 'Processing',
    prefix: '/processing',
    badgeClass: 'bg-badge-completed-bg text-badge-completed-text',
    stageNumber: 4,
    stageTitle: 'Processing & Final Disposal',
    ownStageTitle: 'Processing & Disposal Log',
    queueSubtitle: 'Manage inbound transfer batches, treatment processing logs, and final waste dispositions.',
    kpiLabels: {
      ready: 'Ready for Processing',
      locked: 'Locked (Waiting RTS)',
      submitted: 'Processed & Closed',
    },
    kpiSubtitles: {
      ready: 'Awaiting intake batch',
      locked: 'Waiting RTS transfer',
      submitted: 'Processed & Closed',
    },
  },
};

export const STAGES_LIST = ['COLLECTION', 'TRANSPORTATION', 'RTS', 'PROCESSING'];

export const STATUS_LABELS = {
  CREATED: 'Created',
  COLLECTED: 'Collected',
  IN_TRANSIT: 'In Transit',
  AT_RTS: 'At RTS',
  COMPLETED: 'Completed',
};

export const WASTE_TYPE_LABELS = {
  DRY: 'Dry Waste',
  WET: 'Wet / Organic Waste',
  HAZARDOUS: 'Hazardous Waste',
  ELECTRONIC: 'E-Waste',
};


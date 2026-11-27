export const launchSurfaceFamilies = [
  {
    pl: 'Skóra', en: 'Leather',
    choices: [
      ['leather-classic', 'Czerń z niebieskim szwem', 'Black with blue stitching'],
      ['leather-cognac', 'Koniakowa skóra siodłowa', 'Cognac saddle leather'],
      ['leather-bordeaux', 'Pikowane bordo', 'Quilted burgundy'],
      ['leather-navy', 'Granat perforowany', 'Perforated navy'],
      ['leather-graphite', 'Grafitowa nappa', 'Graphite nappa'],
    ],
  },
  {
    pl: 'Kamień', en: 'Stone',
    choices: [
      ['stone-diamond', 'Czarny diament', 'Black diamond'],
      ['stone-onyx', 'Onyks falisty', 'Wavy onyx'],
      ['stone-obsidian', 'Obsydian lustrzany', 'Mirror obsidian'],
      ['stone-portoro', 'Marmur Portoro', 'Portoro marble'],
      ['stone-labradorite', 'Labradoryt nocny', 'Midnight labradorite'],
    ],
  },
];

export const launchSurfaceIds = launchSurfaceFamilies.flatMap(({choices}) => choices.map(([id]) => id));

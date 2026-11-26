export const vehicleTypes = {
  car:['Osobowe','Passenger cars'],
  van:['Dostawcze','Vans'],
  truck:['Ciężarowe','Trucks'],
  camper:['Kampery','Motorhomes'],
  motorcycle:['Motocykle','Motorcycles'],
  scooter:['Skutery i motorowery','Scooters and mopeds'],
  quad:['Quady (ATV)','ATVs'],
  utv:['Buggy i UTV','Buggies and UTVs'],
  kart:['Gokarty','Go-karts'],
  snowmobile:['Skutery śnieżne','Snowmobiles'],
  bus:['Autobusy i minibusy','Buses and minibuses'],
  garden:['Maszyny ogrodowe i komunalne','Garden and grounds machinery'],
  farm:['Ciągniki i maszyny rolnicze','Tractors and farm vehicles'],
  construction:['Maszyny budowlane','Construction vehicles'],
  forestry:['Maszyny leśne','Forestry machinery'],
  marine_air:['Pojazdy wodne i lotnicze','Watercraft and aircraft'],
  parts:['Części, koła i akcesoria','Parts, wheels and accessories'],
  industrial:['Pojazdy przemysłowe','Industrial vehicles'],
  special:['Pojazdy specjalne','Special-purpose vehicles'],
  trailer:['Przyczepy i naczepy','Trailers and semi-trailers'],
  other:['Inne pojazdy lądowe','Other land vehicles']
};

export const vehicleCatalogOrder = [
  'car','van','camper','truck','bus','trailer','farm','special','construction',
  'forestry','marine_air','garden','industrial','motorcycle','scooter','quad','utv','kart','snowmobile','other','parts'
];

export const carBodies = {
  hatchback:['Hatchback','Hatchback'],sedan:['Sedan','Saloon'],wagon:['Kombi','Estate'],suv:['SUV','SUV'],
  coupe:['Coupé','Coupé'],convertible:['Kabriolet','Convertible'],van:['Van','Van'],pickup:['Pickup','Pickup'],
  panel:['Furgon','Panel van'],tractor:['Ciągnik siodłowy','Tractor unit'],camper:['Kamper','Motorhome'],other:['Inne','Other']
};

export const passengerBodyGroups = [
  {title:['Miejskie i rodzinne','Everyday and family cars'],bodies:{
    hatchback:carBodies.hatchback,sedan:carBodies.sedan,liftback:['Liftback','Liftback'],wagon:carBodies.wagon,
    minivan:['Minivan (MPV)','Minivan (MPV)'],van:['Van osobowy','Passenger van']
  }},
  {title:['SUV-y, terenowe i pickupy','SUVs, off-roaders and pickups'],bodies:{
    crossover:['Crossover','Crossover'],suv:carBodies.suv,suv_coupe:['SUV coupé','SUV coupé'],
    offroad:['Terenowy','Off-roader'],raised_wagon:['Kombi uterenowione','Raised estate'],pickup:carBodies.pickup
  }},
  {title:['Sportowe i otwarte','Sports and open-top cars'],bodies:{
    coupe:carBodies.coupe,fastback:['Fastback','Fastback'],shooting_brake:['Shooting brake','Shooting brake'],
    convertible:carBodies.convertible,roadster:['Roadster','Roadster'],targa:['Targa','Targa'],
    supercar:['Auto sportowe / Supercar','Sports car / Supercar']
  }},
  {title:['Limuzyny i pozostałe','Limousines and other body styles'],bodies:{
    stretch_limo:['Limuzyna przedłużona','Stretch limousine'],classic_car:['Zabytkowy / Klasyk','Classic / vintage car'],
    electric_ev:['Elektryczny (EV)','Electric (EV)'],other:['Inne nadwozia osobowe','Other passenger car bodies']
  }}
];

const passengerBodies = Object.assign({},...passengerBodyGroups.map(group=>group.bodies));
// Keep accepting older records saved with any of the original road-vehicle bodies.
const passengerProfileBodies = {...passengerBodies,panel:carBodies.panel,tractor:carBodies.tractor,camper:carBodies.camper};

const tractorImplements = {
  seed_drill:['Siewnik','Seed drill'],
  disc_harrow:['Brona talerzowa','Disc harrow'],
  farm_plough:['Pług rolniczy','Agricultural plough'],
  fertilizer_spreader:['Rozsiewacz nawozu','Fertiliser spreader'],
  farm_mower:['Kosiarka ciągnikowa','Tractor-mounted mower']
};

const semiTrailerVariants = {
  semi_curtain:['Naczepa kurtynowa','Curtainside semi-trailer'],
  semi_refrigerated:['Naczepa chłodnicza','Refrigerated semi-trailer'],
  semi_tipper:['Naczepa wywrotka','Tipper semi-trailer'],
  semi_container:['Naczepa podkontenerowa','Container chassis semi-trailer'],
  semi_lowbed:['Naczepa niskopodwoziowa','Low-loader semi-trailer'],
  semi_tanker:['Naczepa cysterna','Tanker semi-trailer'],
  semi_walking_floor:['Naczepa ruchoma podłoga (Walking Floor)','Walking floor semi-trailer'],
  semi_silo:['Naczepa silos','Silo semi-trailer'],
  semi_car_transporter:['Naczepa autotransporter (Lohra)','Car transporter semi-trailer']
};
export const semiTrailerBodies=['semi_trailer',...Object.keys(semiTrailerVariants)];

const specialisedBodies = {
  van:{
    panel:carBodies.panel,van_crew:['Brygadówka','Crew van'],van_dropside:['Skrzynia otwarta','Dropside van'],
    van_curtain:['Plandeka','Curtainside van'],van_box:['Kontener','Box van'],van_fridge:['Chłodnia','Refrigerated van'],
    van_tipper:['Wywrotka','Tipper van'],van_transporter:['Autolaweta','Car transporter van'],
    van_chassis:['Podwozie do zabudowy','Chassis cab'],van_insulated:['Izoterma','Insulated van'],
    van_hds:['Podwozie z HDS','Chassis cab with loader crane'],other:['Inne dostawcze / Pozostałe','Other vans']
  },
  truck:{
    tractor:carBodies.tractor,rigid_truck:['Ciężarówka solo','Rigid truck'],dump_truck:['Wywrotka','Tipper truck'],
    box_truck:['Ciężarówka z zabudową skrzyniową','Box truck'],refrigerated_truck:['Ciężarówka chłodnia','Refrigerated truck'],
    flatbed_truck:['Ciężarówka platforma','Flatbed truck'],tanker_truck:['Cysterna samochodowa','Tanker truck'],
    concrete_mixer:['Betonomieszarka','Concrete mixer'],truck_hooklift:['Hakowiec','Hooklift truck'],
    truck_curtain:['Ciężarówka z plandeką','Curtainside truck'],
    timber_truck:['Ciężarówka do drewna','Timber truck'],truck_loader_crane:['Ciężarówka z HDS','Truck with loader crane'],
    other:['Inne ciężarowe / Pozostałe','Other trucks']
  },
  camper:{
    camper_overcab:['Alkowa','Overcab motorhome'],camper_low_profile:['Półintegra','Low-profile motorhome'],
    camper_integrated:['Integra','A-class motorhome'],camper_van:['Kampervan','Campervan'],
    camper:['Kamper bez podanej odmiany','Unspecified motorhome']
  },
  motorcycle:{
    naked:['Naked','Naked'],sportbike:['Sportowy','Sportbike'],touring:['Turystyczny','Touring'],cruiser:['Cruiser','Cruiser'],
    adventure:['Adventure','Adventure'],enduro:['Enduro / cross','Enduro / motocross'],classic:['Klasyczny','Classic'],
    supermoto:['Supermoto','Supermoto'],chopper:['Chopper','Chopper'],scrambler:['Scrambler','Scrambler'],
    minibike:['Minibike / pit bike','Minibike / pit bike'],sport_touring:['Sportowo-turystyczny','Sport touring'],
    cafe_bobber:['Cafe Racer / Bobber','Cafe racer / bobber'],electric_motorcycle:['Motocykl elektryczny','Electric motorcycle'],
    other:['Inne motocykle / Pozostałe','Other motorcycles']
  },
  scooter:{scooter:['Skuter','Scooter'],maxiscooter:['Maksiskuter','Maxi-scooter'],moped:['Motorower','Moped'],
    three_wheel_scooter:['Skuter trójkołowy','Three-wheeled scooter']},
  quad:{atv_utility:['Quad użytkowy','Utility ATV'],atv_sport:['Quad sportowy','Sport ATV'],atv_youth:['Quad młodzieżowy','Youth ATV']},
  utv:{utv:['UTV / side-by-side','UTV / side-by-side'],buggy:['Buggy','Buggy']},
  kart:{track_kart:['Gokart torowy','Track kart'],offroad_kart:['Gokart terenowy','Off-road kart']},
  snowmobile:{snow_touring:['Śnieżny turystyczny','Touring snowmobile'],snow_sport:['Śnieżny sportowy','Sport snowmobile'],snow_utility:['Śnieżny użytkowy','Utility snowmobile'],
    snow_mountain:['Skuter śnieżny górski','Mountain snowmobile']},
  bus:{city_bus:['Autobus miejski','City bus'],coach:['Autokar','Coach'],minibus:['Minibus','Minibus'],
    intercity_bus:['Autobus międzymiastowy','Intercity bus'],double_decker:['Autobus piętrowy','Double-decker bus']},
  garden:{
    garden_mower:['Kosiarka spalinowa do trawy','Petrol lawn mower'],
    riding_mower:['Kosiarka samojezdna','Ride-on lawn mower'],
    zero_turn:['Kosiarka zero-turn','Zero-turn mower'],
    garden_tractor:['Traktorek ogrodowy','Garden tractor'],
    snow_blower:['Odśnieżarka spalinowa','Petrol snow blower'],
    wood_chipper:['Rębak do gałęzi','Wood chipper'],
    stump_grinder:['Frezarka do pni','Stump grinder'],
    motorized_wheelbarrow:['Taczka spalinowa','Motorised wheelbarrow'],
    mini_dumper:['Minidumper','Mini dumper']
  },
  farm:{farm_tractor:['Ciągnik rolniczy','Farm tractor'],combine:['Kombajn','Combine harvester'],
    forage_harvester:['Sieczkarnia samojezdna','Self-propelled forage harvester'],
    beet_harvester:['Kombajn buraczany','Beet harvester'],baler:['Prasa rolnicza','Baler'],sprayer:['Opryskiwacz','Sprayer'],
    farm_loader:['Ładowarka rolnicza / przegubowa','Agricultural / articulated loader'],
    farm_trailer_spreader:['Przyczepa rolnicza / Rozrzutnik','Farm trailer / manure spreader'],
    ...tractorImplements,farm_machine:['Inna maszyna rolnicza','Other farm machinery']},
  construction:{
    excavator:['Koparka','Excavator'],mini_excavator:['Minikoparka','Mini excavator'],backhoe:['Koparko-ładowarka','Backhoe loader'],
    loader:['Ładowarka','Loader'],skid_steer:['Miniładowarka','Skid-steer loader'],
    bulldozer:['Spycharka','Bulldozer'],roller:['Walec','Road roller'],crane:['Żuraw samojezdny','Mobile crane'],
    grader:['Równiarka','Grader'],paver:['Rozściełacz asfaltu','Asphalt paver'],
    articulated_dumper:['Wozidło przegubowe','Articulated dump truck'],drilling_rig:['Wiertnica budowlana','Construction drilling rig'],
    mobile_crusher:['Kruszarka mobilna','Mobile crusher'],other:['Inne maszyny budowlane / Pozostałe','Other construction machinery']
  },
  forestry:{harvester:['Harwester','Harvester'],forwarder:['Forwarder','Forwarder'],skidder:['Skidder / Zrywka','Skidder / log skidder'],
    industrial_wood_chipper:['Rębak leśny przemysłowy','Industrial forestry wood chipper'],
    forestry_trailer_crane:['Przyczepa leśna z żurawiem','Forestry trailer with crane']},
  marine_air:{motor_yacht:['Jacht motorowy','Motor yacht'],motor_boat_rib:['Łódź motorowa / RIB','Motor boat / RIB'],
    jet_ski:['Skuter wodny','Personal watercraft'],sailboat:['Żaglówka','Sailboat'],catamaran:['Katamaran','Catamaran'],
    fishing_boat:['Łódź wędkarska','Fishing boat'],ultralight:['Wiatrakowiec / Ultralekki','Gyrocopter / ultralight'],
    water_air_other:['Inne jednostki','Other craft']},
  parts:{
    engine:['Silniki','Engines'],gearbox:['Skrzynie biegów','Gearboxes'],drivetrain:['Napędy i półosie','Drivetrains and driveshafts'],
    clutch:['Sprzęgła i koła dwumasowe','Clutches and dual-mass flywheels'],differential_turbo:['Mosty, dyferencjały i turbiny','Differentials and turbochargers'],
    bumpers:['Zderzaki','Bumpers'],mirrors:['Lusterka','Mirrors'],headlights:['Reflektory i lampy','Headlights and lamps'],
    windows:['Szyby samochodowe','Vehicle glass'],hood_doors:['Maski, klapy i drzwi','Bonnet, tailgates and doors'],fenders_grilles:['Błotniki i grille','Fenders and grilles'],
    navigation_multimedia:['Nawigacje i multimedia','Navigation and multimedia'],ecu_modules:['Sterowniki i moduły','Control units and modules'],
    sensors_cameras:['Czujniki i kamery','Sensors and cameras'],wiring_electrics:['Instalacje, alternatory i rozruszniki','Wiring, alternators and starters'],
    brakes:['Hamulce: tarcze, klocki i zaciski','Brakes: discs, pads and calipers'],suspension:['Zawieszenie: amortyzatory i sprężyny','Suspension: shock absorbers and springs'],
    steering:['Układ kierowniczy','Steering'],exhaust_intake:['Wydech i dolot','Exhaust and intake'],
    rims_13:['Felgi 13 cali','13-inch rims'],rims_14:['Felgi 14 cali','14-inch rims'],rims_15:['Felgi 15 cali','15-inch rims'],
    rims_16:['Felgi 16 cali','16-inch rims'],rims_17:['Felgi 17 cali','17-inch rims'],rims_18:['Felgi 18 cali','18-inch rims'],
    rims_19:['Felgi 19 cali','19-inch rims'],rims_20:['Felgi 20 cali','20-inch rims'],rims_21:['Felgi 21 cali','21-inch rims'],
    rims_22:['Felgi 22 cale','22-inch rims'],rims_23:['Felgi 23 cale','23-inch rims'],rims_24:['Felgi 24 cale','24-inch rims'],
    tires_by_size:['Opony według rozmiaru','Tyres by size'],workshop_equipment:['Wyposażenie warsztatowe','Workshop equipment'],
    interior:['Wnętrze i akcesoria','Interior and accessories'],other_parts:['Inne części i akcesoria','Other parts and accessories']
  },
  industrial:{forklift:['Wózek widłowy','Forklift'],electric_pallet_truck:['Elektryczny wózek paletowy','Electric pallet truck'],
    telehandler:['Ładowarka teleskopowa','Telehandler'],aerial_platform:['Podnośnik koszowy','Aerial work platform'],
    scissor_lift:['Podnośnik nożycowy','Scissor lift'],industrial_cart:['Wózek transportowy','Industrial transporter'],
    reach_truck:['Wózek wysokiego składowania','Reach truck'],order_picker:['Wózek do kompletacji','Order picker'],
    warehouse_tug:['Ciągnik magazynowy','Warehouse tow tractor']},
  special:{tow_truck:['Laweta z napędem','Tow truck'],ambulance:['Ambulans','Ambulance'],fire_engine:['Wóz strażacki','Fire engine'],
    service_vehicle:['Pojazd serwisowy','Service vehicle'],municipal:['Pojazd komunalny','Municipal vehicle'],
    road_sweeper:['Zamiatarka uliczna','Street sweeper'],refuse_truck:['Śmieciarka','Refuse truck'],snow_plow:['Pług śnieżny','Snowplow'],
    vacuum_truck:['Samochód asenizacyjny','Vacuum tanker']},
  trailer:{
    cargo_trailer:['Przyczepa towarowa','Cargo trailer'],flatbed_trailer:['Laweta przyczepowa','Flatbed trailer'],
    motorcycle_trailer:['Przyczepa do motocykli','Motorcycle trailer'],scooter_quad_trailer:['Przyczepa do skuterów / quadów','Scooter / quad trailer'],
    horse_trailer:['Przyczepa do koni','Horse trailer'],
    boat_trailer:['Przyczepa do łodzi','Boat trailer'],refrigerated_trailer:['Przyczepa chłodnicza','Refrigerated trailer'],
    box_trailer:['Przyczepa zamknięta','Enclosed cargo trailer'],plant_trailer:['Przyczepa do maszyn','Plant trailer'],
    tipper_trailer:['Przyczepa wywrotka','Tipper trailer'],travel_trailer:['Przyczepa kempingowa','Travel trailer'],
    bale_trailer:['Przyczepa do bel','Bale trailer'],livestock_trailer:['Przyczepa do bydła','Cattle trailer'],
    catering_trailer:['Przyczepa gastronomiczna','Catering trailer'],
    semi_trailer:['Naczepa','Semi-trailer'],...semiTrailerVariants,
    // Older feeds also use the generic Polish and English labels for this same stored value.
    other:['Pozostałe przyczepy','Other trailers',...carBodies.other]
  },
  other:{microcar:['Mikrosamochód','Microcar'],trike:['Trójkołowiec','Motor tricycle'],tuk_tuk:['Tuk-tuk pasażerski','Passenger tuk-tuk'],
    cargo_tricycle:['Trójkołowiec transportowy','Cargo tricycle'],mobility_scooter:['Skuter inwalidzki','Mobility scooter'],
    e_bike:['Rower elektryczny','Electric bike'],bicycle:['Rower tradycyjny','Traditional bicycle'],
    e_scooter:['Hulajnoga elektryczna','Electric kick scooter'],mono_segway:['Monocykl / Segway','Monowheel / Segway'],
    golf_cart:['Pojazd golfowy','Golf cart']}
};

export const vehicleBodies = Object.assign({},passengerBodies,carBodies,...Object.values(specialisedBodies),{other:carBodies.other});

export const partsCatalogGroups = [
  {id:'silnik-naped',title:['Silnik, skrzynia i napęd','Engine, gearbox and drivetrain'],bodies:{
    engine:specialisedBodies.parts.engine,gearbox:specialisedBodies.parts.gearbox,drivetrain:specialisedBodies.parts.drivetrain,
    clutch:specialisedBodies.parts.clutch,differential_turbo:specialisedBodies.parts.differential_turbo
  }},
  {id:'nadwozie-szyby',title:['Nadwozie, lampy i szyby','Bodywork, lights and glass'],bodies:{
    bumpers:specialisedBodies.parts.bumpers,mirrors:specialisedBodies.parts.mirrors,headlights:specialisedBodies.parts.headlights,
    windows:specialisedBodies.parts.windows,hood_doors:specialisedBodies.parts.hood_doors,fenders_grilles:specialisedBodies.parts.fenders_grilles
  }},
  {id:'elektronika',title:['Elektronika i multimedia','Electronics and multimedia'],bodies:{
    navigation_multimedia:specialisedBodies.parts.navigation_multimedia,ecu_modules:specialisedBodies.parts.ecu_modules,
    sensors_cameras:specialisedBodies.parts.sensors_cameras,wiring_electrics:specialisedBodies.parts.wiring_electrics
  }},
  {id:'hamulce-zawieszenie',title:['Hamulce, zawieszenie i układ kierowniczy','Brakes, suspension and steering'],bodies:{
    brakes:specialisedBodies.parts.brakes,suspension:specialisedBodies.parts.suspension,steering:specialisedBodies.parts.steering,
    exhaust_intake:specialisedBodies.parts.exhaust_intake
  }},
  {id:'felgi-opony',title:['Felgi i opony — rozmiary','Wheels and tyres — sizes'],bodies:{
    rims_13:specialisedBodies.parts.rims_13,rims_14:specialisedBodies.parts.rims_14,rims_15:specialisedBodies.parts.rims_15,
    rims_16:specialisedBodies.parts.rims_16,rims_17:specialisedBodies.parts.rims_17,rims_18:specialisedBodies.parts.rims_18,
    rims_19:specialisedBodies.parts.rims_19,rims_20:specialisedBodies.parts.rims_20,rims_21:specialisedBodies.parts.rims_21,
    rims_22:specialisedBodies.parts.rims_22,rims_23:specialisedBodies.parts.rims_23,rims_24:specialisedBodies.parts.rims_24,
    tires_by_size:specialisedBodies.parts.tires_by_size
  }},
  {id:'warsztat-pozostale',title:['Warsztat i pozostałe','Workshop and other'],bodies:{
    workshop_equipment:specialisedBodies.parts.workshop_equipment,interior:specialisedBodies.parts.interior,other_parts:specialisedBodies.parts.other_parts
  }}
];

// Listings created before the detailed parts catalogue keep an intelligible label
// in cards and edit forms, while new listings use the precise subcategories above.
const legacyPartBodies={
  engines_gearboxes:['Silniki i skrzynie biegów','Engines and gearboxes'],wheels_tires:['Felgi i opony','Wheels and tyres'],
  body_parts:['Części karoserii','Body parts'],electronics_navigation:['Elektronika i nawigacje','Electronics and navigation']
};

export function catalogBodyGroups(type) {
  if (type==='car') return passengerBodyGroups;
  if (type==='parts') return partsCatalogGroups;
  if (type==='trailer') {
    const {semi_trailer,...bodies}=specialisedBodies.trailer;
    return [{bodies}];
  }
  return Object.hasOwn(specialisedBodies,type)?[{bodies:specialisedBodies[type]}]:[];
}

// Older road-vehicle listings can still carry an original shared body value.
const sharedRoadBodies=new Set(['van','truck','camper']);
export function vehicleBodyChoices(type,saved='') {
  const bodies=type==='car'?passengerBodies:Object.hasOwn(specialisedBodies,type)?specialisedBodies[type]:carBodies;
  const choices={...bodies,other:bodies.other??carBodies.other};
  if (type==='parts'&&Object.hasOwn(legacyPartBodies,saved)) choices[saved]=legacyPartBodies[saved];
  if ((type==='car'||sharedRoadBodies.has(type))&&Object.hasOwn(carBodies,saved)&&!Object.hasOwn(choices,saved)) {
    choices[saved]=carBodies[saved];
  }
  return choices;
}

const road = {road:true,motorized:true,doors:true,hours:false,fuelRequired:true};
const offroad = {road:false,motorized:true,doors:false,hours:true,fuelRequired:true};
const accessory = {road:false,motorized:false,doors:false,hours:false,fuelRequired:false};
const rules = {
  motorcycle:offroad,scooter:{...offroad,hours:false},quad:offroad,utv:offroad,kart:offroad,snowmobile:offroad,
  garden:offroad,farm:{...offroad,doors:true},construction:{...offroad,doors:true},forestry:offroad,
  marine_air:{...offroad,fuelRequired:false},parts:accessory,industrial:offroad,
  special:{...offroad,doors:true},
  trailer:{...offroad,motorized:false,hours:false,fuelRequired:false},
  other:{...offroad,fuelRequired:false}
};

// Mounted and towed implements use the tractor's power. Their listings have no engine fields.
export const bodyFeatureOverrides={
  farm:Object.fromEntries(Object.keys(tractorImplements).map(key=>[key,rules.trailer])),
  other:{tuk_tuk:offroad,cargo_tricycle:offroad}
};

export function vehicleFeatures(type,body) {
  const overrides=Object.hasOwn(bodyFeatureOverrides,type)?bodyFeatureOverrides[type]:{};
  if (Object.hasOwn(overrides,body)) return overrides[body];
  return Object.hasOwn(rules,type)?rules[type]:road;
}

export function vehicleProfile(type,body) {
  const features=vehicleFeatures(type,body);
  if (type==='car') return {...features,bodies:passengerProfileBodies};
  const bodies=Object.hasOwn(specialisedBodies,type)?
    {...(sharedRoadBodies.has(type)?carBodies:{}),...specialisedBodies[type],other:specialisedBodies[type].other??carBodies.other}:carBodies;
  return {...features,bodies};
}

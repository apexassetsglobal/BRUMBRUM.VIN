import { fail, integer, numeric, text, truth } from './core.js';

// Stable slugs are shared by the landing page, listing editor and API filters.
export const robotCategories = {
  humanoidalne:['Humanoidalne','Humanoid'],
  przemyslowe:['Przemysłowe i coboty','Industrial robots and cobots'],
  kroczace:['Kroczące','Legged robots'],
  uslugowe:['Usługowe','Service robots'],
  magazynowe:['Magazynowe','Warehouse robots'],
  rolnicze:['Rolnicze','Agricultural robots'],
  budowlane:['Budowlane','Construction robots'],
  'domowe-ogrodowe':['Domowe i ogrodowe','Home and garden robots'],
  medyczne:['Medyczne','Medical robots'],
  drony:['Drony i systemy bezzałogowe','Drones and unmanned systems'],
  inspekcyjne:['Inspekcyjne i specjalistyczne','Inspection and specialist robots']
};

// Suggestions are not listings, stock claims, or a restriction on seller input.
export const robotBrands = [
  'ABB','Agility Robotics','AgXeed','ANYbotics','Blue Robotics','Boston Dynamics',
  'Brokk','DEEP Robotics','Deep Trekker','DJI','DOBOT','Doosan Robotics',
  'Elephant Robotics','EngineAI','FANUC','Fourier','Gausium','Geek+',
  'Husqvarna','JAKA','Kawasaki Robotics','KEENON','KUKA','Locus Robotics',
  'MiR','Naïo Technologies','NEURA Robotics','OMRON','PAL Robotics','Pudu Robotics',
  'ROBOTIS','UBTECH','Unitree','Universal Robots','Yaskawa'
];
export const robotTradeModes = {
  sale:['Sprzedaż','For sale'],rent:['Wynajem','For rent'],both:['Sprzedaż i wynajem','Sale and rental']
};
export const robotRentalUnits = {day:['dzień','day'],week:['tydzień','week'],month:['miesiąc','month']};
export const robotCurrencies = ['PLN','EUR','USD','GBP','CHF','CZK'];
export const robotDefaultData = {
  type:'robot',market:'robotics',robotCategory:'',tradeMode:'sale',condition:'used',damage:'unknown',
  country:'Polska',currency:'PLN',contact:'message',equipment:[],rentalPrice:null,rentalUnit:'day',
  deposit:0,stock:1,leadTime:null,minimumRental:1,specs:''
};

const choice = (value, choices) => Object.hasOwn(choices,value)?value:'';
const hasValue = value => value!==undefined && value!==null && value!=='';
const validPhone = value => /^\+?\d{7,15}$/.test(value?.replace(/[ ()-]/g,'') || '');
const money = (value,min=0.01) => {
  const amount=numeric(value,min,100000000);
  return amount!==null && Math.abs(amount*100-Math.round(amount*100))<0.000001 ? Math.round(amount*100)/100 : null;
};

export function validateRobotListing(ctx, raw, strict=false) {
  const tradeMode=choice(raw.tradeMode,robotTradeModes);
  const rent=tradeMode==='rent'||tradeMode==='both';
  const sale=tradeMode==='sale'||tradeMode==='both';
  const data={
    type:'robot',market:'robotics',robotCategory:choice(raw.robotCategory,robotCategories),tradeMode,
    make:text(raw.make,50),model:text(raw.model,60),variant:text(raw.variant,95),
    condition:choice(raw.condition,{new:1,used:1}),damage:choice(raw.damage,{no:1,yes:1,unknown:1})||'unknown',
    year:integer(raw.year,1900,new Date().getFullYear()+1),
    // Vehicle-specific columns remain empty; a robot never needs a VIN or mileage.
    body:'',fuel:'',gearbox:'',drive:'',mileage:null,power:null,
    price:sale?money(raw.price):null,currency:robotCurrencies.includes(raw.currency)?raw.currency:'',
    rentalPrice:rent?money(raw.rentalPrice):null,
    rentalUnit:choice(raw.rentalUnit,robotRentalUnits)||(!hasValue(raw.rentalUnit)?'day':''),
    deposit:rent?(hasValue(raw.deposit)?money(raw.deposit,0):0):0,
    stock:integer(raw.stock,0,100000),leadTime:integer(raw.leadTime,0,3650),
    minimumRental:rent?(hasValue(raw.minimumRental)?integer(raw.minimumRental,1,3650):1):1,
    city:text(raw.city,90),region:text(raw.region,90),country:text(raw.country,80),
    specs:text(raw.specs,3000),description:text(raw.description,7000),description_en:text(raw.description_en,7000),
    equipment:Array.isArray(raw.equipment)?[...new Set(raw.equipment.map(value=>text(value,100)).filter(Boolean))].slice(0,40):[],
    negotiable:truth(raw.negotiable),
    contact:choice(raw.contact,{message:1,phone:1})||'message',listingPhone:text(raw.listingPhone,30)
  };
  const fields=[];
  for(const key of ['year','stock','leadTime',...(sale?['price']:[]),...(rent?['rentalPrice','deposit','minimumRental']:[])]) {
    if(hasValue(raw[key]) && data[key]===null) fields.push(key);
  }
  if(strict) {
    for(const key of ['make','model','robotCategory','tradeMode','condition','currency','city','country','stock',
      ...(sale?['price']:[]),...(rent?['rentalPrice','rentalUnit','minimumRental']:[])]) {
      if(data[key]===null||data[key]==='') fields.push(key);
    }
    if(data.description.length<12) fields.push('description');
    if(data.listingPhone ? !validPhone(data.listingPhone) : data.contact==='phone' && !(ctx.user?.phone && ctx.user.show_phone)) fields.push('listingPhone');
  }
  if(fields.length) fail(422,'Uzupełnij wymagane pola robota lub popraw ich wartości.',
    'Complete the required robot fields or correct their values.',{fields:[...new Set(fields)]});
  return data;
}

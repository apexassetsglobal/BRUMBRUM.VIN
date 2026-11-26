import { changes, fail, forbidden, id, integer, isId, missing, now, parse, rate, requireUser, row, rows, stmt, text } from './core.js';

export const orderStatusLabels = {
  requested:['Oczekuje na sprzedawcę','Awaiting seller'],
  accepted:['Zaakceptowane','Accepted'],
  rejected:['Odrzucone','Rejected'],
  cancelled:['Anulowane','Cancelled'],
  completed:['Zrealizowane','Completed']
};
export const orderKindLabels = {purchase:['Zakup','Purchase'],rental:['Wynajem','Rental']};
const unitDays = {day:1,week:7,month:30};
const currencies = new Set(['PLN','EUR','USD','GBP','CHF','CZK']);
const dayMilliseconds = 86400000;
const identityColumns=['make','model','variant','condition','damage','year','city'];
const identityDetails=['robotCategory','specs','description','description_en','country'];

// Dates are calendar dates in the marketplace's time zone. Rental endsOn is
// exclusive: 10–12 November is two days, and a next rental may start on the 12th.
const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const validDay = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const dayNumber = value => Date.parse(value+'T00:00:00Z')/dayMilliseconds;
const plusDays = (value,days) => new Date((dayNumber(value)+days)*dayMilliseconds).toISOString().slice(0,10);
const total = (...values) => {
  const result=values.reduce((a,b)=>a*b,1);
  if (!Number.isSafeInteger(result)||result<0) fail(422,'Łączna kwota jest zbyt duża. Zmniejsz liczbę sztuk lub okres najmu.','The total is too large. Reduce the quantity or rental duration.');
  return result;
};

function identitySnapshot(listing,data) {
  return {version:1,...Object.fromEntries(identityColumns.map(key=>[key,listing[key]??''])),
    ...Object.fromEntries(identityDetails.map(key=>[key,data[key]??'']))};
}

// A requested order is tied to the equipment the buyer actually saw, not just
// its price. A changed description also requires a fresh request; accepted
// orders retain their own snapshot and are never repriced by this predicate.
function matchingIdentitySQL(order='o',listing='l') {
  const saved=key=>`COALESCE(json_extract(${order}.listing_snapshot,'$.identity.${key}'),'')`;
  return `json_extract(${order}.listing_snapshot,'$.identity.version')=1 AND `+[
    ...identityColumns.map(key=>`COALESCE(${listing}.${key},'') IS ${saved(key)}`),
    ...identityDetails.map(key=>`COALESCE(json_extract(${listing}.data,'$.${key}'),'') IS ${saved(key)}`)
  ].join(' AND ');
}

// All supported currencies use two decimal places. Do not trust a price sent
// by the browser and avoid floating-point arithmetic when creating snapshots.
function minorAmount(value,{allowZero=false}={}) {
  const raw=String(value??'');
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(raw)) return null;
  const [whole,fraction='']=raw.split('.');
  const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  return Number.isSafeInteger(result)&&(allowZero?result>=0:result>0)?result:null;
}

async function activeUser(ctx) {
  const user=requireUser(ctx);
  if (!await row(ctx.db,'SELECT id FROM users WHERE id=? AND scope=? AND deleted_at IS NULL',user.id,ctx.scope)) forbidden();
  return user;
}

function normalizedRequest(body) {
  const key=text(body.key,90);
  const kind=body.kind;
  const quantity=integer(body.quantity??1,1,100000);
  if (!isId(key)||key!==body.key) fail(422,'Odśwież formularz zamówienia.','Reload the order form.');
  if (!Object.hasOwn(orderKindLabels,kind)||quantity===null) fail(422,'Wybierz zakup lub wynajem i prawidłową liczbę sztuk.','Choose purchase or rental and a valid quantity.');
  const startsOn=kind==='rental'?text(body.startsOn,10):null;
  const endsOn=kind==='rental'?text(body.endsOn,10):null;
  if (kind==='rental'&&(!validDay(startsOn)||!validDay(endsOn)||startsOn!==body.startsOn||endsOn!==body.endsOn||endsOn<=startsOn)) {
    fail(422,'Podaj prawidłowy termin najmu. Data zwrotu musi być późniejsza od daty rozpoczęcia.','Enter valid rental dates. The return date must be after the start date.',{fields:['startsOn','endsOn']});
  }
  return {key,kind,quantity,startsOn,endsOn,note:text(body.note,2000)};
}

function quoteFor(listing,request,currentDay) {
  const data=parse(listing.data);
  if (!currencies.has(listing.currency)) fail(422,'Waluta oferty nie jest obsługiwana. Skontaktuj się ze sprzedawcą.','This offer currency is not supported. Contact the seller.');
  if (request.kind==='purchase'&&!['sale','both'].includes(data.tradeMode) || request.kind==='rental'&&!['rent','both'].includes(data.tradeMode)) {
    fail(422,'Ta oferta nie obsługuje wybranego rodzaju zamówienia.','This offer does not support the selected order type.');
  }
  const stock=integer(data.stock,0,100000);
  if (stock===null||stock<request.quantity) fail(409,'Brak wystarczającej liczby sztuk.','There are not enough units available.');
  let unitAmount,unitDeposit=0,billingUnit='item',billingPeriods=1;
  if (request.kind==='purchase') {
    unitAmount=listing.price;
    if (!Number.isSafeInteger(unitAmount)||unitAmount<=0) fail(422,'Sprzedawca nie podał ceny zakupu.','The seller has not provided a purchase price.');
  } else {
    billingUnit=data.rentalUnit;
    const days=dayNumber(request.endsOn)-dayNumber(request.startsOn);
    const leadTime=integer(data.leadTime??0,0,3650);
    const minimumRental=integer(data.minimumRental??1,1,3650);
    if (!Object.hasOwn(unitDays,billingUnit)||leadTime===null||minimumRental===null) fail(422,'Sprzedawca musi uzupełnić warunki wynajmu.','The seller must complete the rental terms.');
    const earliest=plusDays(currentDay,leadTime);
    if (request.startsOn<earliest) fail(422,'Najem może rozpocząć się najwcześniej '+earliest+'.','The earliest rental start is '+earliest+'.',{fields:['startsOn']});
    if (days<minimumRental*unitDays[billingUnit]||days>3660) fail(422,'Termin nie spełnia minimalnego okresu najmu lub przekracza 3660 dni.','The dates do not meet the minimum rental period or exceed 3660 days.',{fields:['endsOn']});
    billingPeriods=Math.ceil(days/unitDays[billingUnit]);
    unitAmount=minorAmount(data.rentalPrice);
    unitDeposit=minorAmount(data.deposit??0,{allowZero:true});
    if (unitAmount===null||unitDeposit===null) fail(422,'Sprzedawca musi uzupełnić cenę i kaucję.','The seller must complete the price and deposit.');
  }
  const subtotal=total(unitAmount,request.quantity,billingPeriods);
  const deposit=total(unitDeposit,request.quantity);
  if (!Number.isSafeInteger(subtotal+deposit)) fail(422,'Łączna kwota jest zbyt duża.','The total is too large.');
  return {unitAmount,unitDeposit,billingUnit,billingPeriods,subtotal,deposit,data};
}

function stockLedgerSQL(listing) {
  return {
    stock:`COALESCE(CAST(json_extract(${listing}.data,'$.stock') AS INTEGER),0)`,
    sold:`COALESCE((SELECT SUM(s.quantity) FROM robot_orders s WHERE s.listing_id=${listing}.id AND s.kind='purchase' AND s.status IN ('accepted','completed')),0)`,
    activeAt:point=>`COALESCE((SELECT SUM(b.quantity) FROM robot_orders b WHERE b.listing_id=${listing}.id AND b.kind='rental' AND b.status='accepted' AND b.starts_on<=(${point}) AND b.ends_on>(${point})),0)`
  };
}

// The stock field describes the offered pool. Purchases permanently consume
// units while accepted rentals occupy units only during their [start,end)
// interval. A conditional write evaluates the latest ledger in the same SQL
// statement, so concurrent accepts cannot overbook the pool.
// Capacity is checked at the initial date and every rental start inside the
// interval; this checks peak concurrency instead of summing disjoint bookings.
function capacitySQL(order='o',listing='l',currentDay=today()) {
  if (!validDay(currentDay)) throw new Error('invalid_internal_calendar_date');
  const begin=`CASE WHEN ${order}.kind='rental' THEN ${order}.starts_on ELSE '${currentDay}' END`;
  const {stock,sold,activeAt}=stockLedgerSQL(listing);
  return `${sold}+${order}.quantity+${activeAt(begin)}<=${stock}
    AND NOT EXISTS (SELECT 1 FROM robot_orders a WHERE a.listing_id=${listing}.id AND a.kind='rental' AND a.status='accepted'
      AND a.starts_on>(${begin}) AND (${order}.kind='purchase' OR a.starts_on<${order}.ends_on)
      AND ${sold}+${order}.quantity+${activeAt('a.starts_on')}>${stock})`;
}

// Apply this predicate inside the listing UPDATE/upsert, not as a preflight.
// Accepted purchases consume permanent capacity; active/future rentals consume
// only their peak concurrent capacity, including rentals already in progress.
export function robotStockGuardSQL(listing,stock,currentDay=today()) {
  if(!/^[a-z_][a-z0-9_]*$/i.test(listing)||integer(stock,0,100000)===null||!validDay(currentDay)) {
    throw new Error('invalid_internal_stock_guard');
  }
  const pool=Number(stock);
  const {sold,activeAt}=stockLedgerSQL(listing);
  return `${sold}+${activeAt("'"+currentDay+"'")}<=${pool}
    AND NOT EXISTS (SELECT 1 FROM robot_orders a WHERE a.listing_id=${listing}.id AND a.kind='rental' AND a.status='accepted'
      AND a.starts_on>'${currentDay}' AND ${sold}+${activeAt('a.starts_on')}>${pool})`;
}

// A UI upper bound from the same ledger as the atomic order writes. A purchase
// must leave room for every confirmed rental. Rental capacity depends on the
// selected interval, so its returned pool is not a promise for any given date.
export async function robotOrderLimits(ctx,listingId) {
  const currentDay=today();
  const {stock,sold,activeAt}=stockLedgerSQL('l');
  const peak=`MAX(${activeAt("'"+currentDay+"'")},COALESCE((SELECT MAX(${activeAt('a.starts_on')}) FROM robot_orders a
    WHERE a.listing_id=l.id AND a.kind='rental' AND a.status='accepted' AND a.starts_on>'${currentDay}'),0))`;
  const record=await row(ctx.db,`SELECT MAX(0,${stock}-${sold}-${peak}) AS purchase,MAX(0,${stock}-${sold}) AS rental
    FROM listings l JOIN users u ON u.id=l.user_id WHERE l.id=? AND l.scope=? AND l.type='robot' AND l.status='published' AND u.deleted_at IS NULL`,listingId,ctx.scope);
  return record?{purchase:record.purchase,rental:record.rental}:{purchase:0,rental:0};
}

// This read supplies a useful error after the atomic predicate rejected a
// write. It is not the concurrency control: the write always has its own guard.
export async function assertRobotStock(ctx,listingId,stock) {
  const blocked=await row(ctx.db,`SELECT id FROM listings WHERE id=? AND scope=? AND type='robot'
    AND NOT (${robotStockGuardSQL('listings',stock)})`,listingId,ctx.scope);
  if(blocked) fail(409,'Pula sztuk nie może być mniejsza niż sprzedane sztuki i potwierdzone rezerwacje. Zachowaj wystarczającą pulę lub najpierw rozwiąż istniejące zobowiązania.',
    'The unit pool cannot be smaller than sold units and confirmed reservations. Keep sufficient capacity or resolve the existing commitments first.',{fields:['stock']});
}

const selection=`SELECT o.*,b.name AS buyer_name,s.name AS seller_name,l.slug AS current_slug
  FROM robot_orders o JOIN users b ON b.id=o.buyer_id JOIN users s ON s.id=o.seller_id JOIN listings l ON l.id=o.listing_id`;

function hydrateOrder(ctx,record) {
  const {listing_snapshot,...rest}=record;
  const snapshot=parse(listing_snapshot);
  const isBuyer=record.buyer_id===ctx.user.id,isSeller=record.seller_id===ctx.user.id;
  const slug=record.current_slug||snapshot.slug||record.listing_id;
  const t=ctx.t||((pl)=>pl);
  return {...rest,snapshot,isBuyer,isSeller,title:snapshot.title||[snapshot.make,snapshot.model].filter(Boolean).join(' '),
    listingSlug:slug,listingUrl:(ctx.prefix||'')+'/roboty/oferta/'+encodeURIComponent(slug),
    buyerName:record.buyer_name,sellerName:record.seller_name,
    kindLabel:t(...orderKindLabels[record.kind]),statusLabel:t(...orderStatusLabels[record.status]),
    total_amount:record.subtotal_amount+record.deposit_amount,
    canAccept:isSeller&&record.status==='requested',canReject:isSeller&&record.status==='requested',
    canCancel:record.status==='requested'||isSeller&&record.status==='accepted',
    canComplete:isSeller&&record.status==='accepted'&&(record.kind==='purchase'||record.ends_on<=today())};
}

async function rawOrder(ctx,key) {
  const user=await activeUser(ctx);
  if (!isId(key)) missing();
  const result=await row(ctx.db,selection+' WHERE o.id=? AND o.scope=? AND (o.buyer_id=? OR o.seller_id=?)',key,ctx.scope,user.id,user.id);
  if (!result) missing();
  return result;
}

export async function orderDetail(ctx,key) {return hydrateOrder(ctx,await rawOrder(ctx,key));}

export async function listOrders(ctx) {
  const user=await activeUser(ctx);
  return (await rows(ctx.db,selection+' WHERE o.scope=? AND (o.buyer_id=? OR o.seller_id=?) ORDER BY o.updated_at DESC,o.id DESC LIMIT 200',ctx.scope,user.id,user.id))
    .map(record=>hydrateOrder(ctx,record));
}

const resultFor = async (ctx,key) => {
  const order=await orderDetail(ctx,key);
  return {id:key,status:order.status,next:(ctx.prefix||'')+'/roboty/zamowienia/'+key,order};
};

async function replay(ctx,listingKey,request) {
  const existing=await row(ctx.db,'SELECT * FROM robot_orders WHERE buyer_id=? AND client_key=?',ctx.user.id,request.key);
  if (!existing) return null;
  const snapshot=parse(existing.listing_snapshot);
  if (existing.scope!==ctx.scope||![existing.listing_id,snapshot.slug].includes(listingKey)||existing.kind!==request.kind||existing.quantity!==request.quantity||
      existing.starts_on!==request.startsOn||existing.ends_on!==request.endsOn||existing.note!==request.note) {
    fail(409,'Ten formularz został już użyty do innego zamówienia. Odśwież stronę.','This form has already been used for a different order. Reload the page.');
  }
  return resultFor(ctx,existing.id);
}

export async function createOrder(ctx,listingKey,body) {
  const buyer=await activeUser(ctx);
  if (!isId(listingKey)) missing();
  const request=normalizedRequest(body);
  const repeated=await replay(ctx,listingKey,request);
  if (repeated) return repeated;
  await rate(ctx,'robot-orders',25,3600);
  const listing=await row(ctx.db,`SELECT l.*,u.name AS seller_name FROM listings l JOIN users u ON u.id=l.user_id
    WHERE (l.id=? OR l.slug=?) AND l.scope=? AND l.type='robot' AND l.status='published' AND u.deleted_at IS NULL`,listingKey,listingKey,ctx.scope);
  if (!listing) missing();
  if (listing.user_id===buyer.id) fail(422,'Nie możesz zamówić własnego ogłoszenia.','You cannot order your own listing.');
  const currentDay=today();
  const quote=quoteFor(listing,request,currentDay);
  const candidate=id(),at=now();
  const snapshot=JSON.stringify({title:[listing.make,listing.model,listing.variant].filter(Boolean).join(' '),slug:listing.slug||listing.id,
    make:listing.make,model:listing.model,variant:listing.variant,robotCategory:quote.data.robotCategory,condition:listing.condition,
    city:listing.city,country:quote.data.country,leadTime:quote.data.leadTime??0,minimumRental:quote.data.minimumRental??1,
    sellerName:listing.seller_name,tradeMode:quote.data.tradeMode,stock:quote.data.stock,identity:identitySnapshot(listing,quote.data)});
  const records=await ctx.db.batch([
    stmt(ctx.db,`WITH o AS (SELECT ? AS id,? AS kind,? AS quantity,? AS starts_on,? AS ends_on)
      INSERT OR IGNORE INTO robot_orders(id,scope,listing_id,buyer_id,seller_id,client_key,kind,status,quantity,starts_on,ends_on,
        billing_unit,billing_periods,unit_amount,unit_deposit_amount,subtotal_amount,deposit_amount,currency,listing_snapshot,note,created_at,updated_at)
      SELECT o.id,l.scope,l.id,?,l.user_id,?,o.kind,'requested',o.quantity,o.starts_on,o.ends_on,?,?,?,?,?,?,?,?,?,?,?
      FROM listings l,o WHERE l.id=? AND l.scope=? AND l.type='robot' AND l.status='published' AND l.revision=? AND l.data=? AND l.price IS ? AND l.currency=?
      AND EXISTS(SELECT 1 FROM users WHERE id=l.user_id AND deleted_at IS NULL)
      AND EXISTS(SELECT 1 FROM users WHERE id=? AND scope=l.scope AND deleted_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM blocks WHERE (user_id=? AND blocked_id=l.user_id) OR (user_id=l.user_id AND blocked_id=?))
      AND ${capacitySQL('o','l',currentDay)}`,
      candidate,request.kind,request.quantity,request.startsOn,request.endsOn,buyer.id,request.key,
      quote.billingUnit,quote.billingPeriods,quote.unitAmount,quote.unitDeposit,quote.subtotal,quote.deposit,listing.currency,snapshot,request.note,at,at,
      listing.id,ctx.scope,listing.revision,listing.data,listing.price,listing.currency,buyer.id,buyer.id,buyer.id),
    stmt(ctx.db,`INSERT INTO notifications(id,user_id,kind,data,created_at)
      SELECT ?,?,'robot-order',?,? WHERE EXISTS(SELECT 1 FROM robot_orders WHERE id=?)
      AND EXISTS(SELECT 1 FROM users WHERE id=? AND notify_listings=1)`,id(),listing.user_id,
      JSON.stringify({order:candidate,listing:listing.id,kind:request.kind,status:'requested'}),at,candidate,listing.user_id)
  ]);
  if (!changes(records[0])) {
    const retried=await replay(ctx,listingKey,request);
    if (retried) return retried;
    fail(409,'Oferta lub dostępność uległa zmianie albo kontakt jest zablokowany. Odśwież ofertę i wybierz inny termin lub liczbę sztuk.',
      'The offer or availability changed, or contact is blocked. Reload the offer and choose different dates or quantity.');
  }
  return resultFor(ctx,candidate);
}

export async function changeOrderStatus(ctx,key,body) {
  const order=await rawOrder(ctx,key);
  const target=body.status;
  if (!['accepted','rejected','cancelled','completed'].includes(target)) fail(422,'Wybierz prawidłowy status zamówienia.','Choose a valid order status.');
  const seller=ctx.user.id===order.seller_id;
  if (!seller&&(target!=='cancelled'||!['requested','cancelled'].includes(order.status))) forbidden();
  if (order.status===target) return resultFor(ctx,key);
  if (!(order.status==='requested'&&['accepted','rejected','cancelled'].includes(target)||order.status==='accepted'&&['cancelled','completed'].includes(target))) {
    fail(409,'Zamówienie ma już inny status. Odśwież stronę.','This order already has a different status. Reload the page.');
  }
  const currentDay=today();
  if (target==='completed'&&order.kind==='rental'&&order.ends_on>currentDay) fail(422,'Najem można zakończyć po upływie zarezerwowanego terminu. Wcześniej użyj anulowania.','Complete the rental after its reserved period ends. Use cancellation for an earlier release.');
  let condition='';
  if (target==='accepted') {
    condition=`AND EXISTS(SELECT 1 FROM listings l WHERE l.id=o.listing_id AND l.scope=o.scope AND l.user_id=o.seller_id
      AND l.type='robot' AND l.status='published' AND l.currency=o.currency
      AND EXISTS(SELECT 1 FROM users WHERE id=o.buyer_id AND deleted_at IS NULL)
      AND EXISTS(SELECT 1 FROM users WHERE id=o.seller_id AND deleted_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM blocks WHERE (user_id=o.buyer_id AND blocked_id=o.seller_id) OR (user_id=o.seller_id AND blocked_id=o.buyer_id))
      AND ${matchingIdentitySQL('o','l')}
      AND ((o.kind='purchase' AND json_extract(l.data,'$.tradeMode') IN ('sale','both') AND l.price=o.unit_amount)
        OR (o.kind='rental' AND json_extract(l.data,'$.tradeMode') IN ('rent','both')
          AND o.starts_on>=date('${currentDay}','+'||COALESCE(json_extract(l.data,'$.leadTime'),0)||' days')
          AND json_extract(l.data,'$.rentalUnit')=o.billing_unit
          AND CAST(ROUND(CAST(json_extract(l.data,'$.rentalPrice') AS REAL)*100) AS INTEGER)=o.unit_amount
          AND CAST(ROUND(CAST(COALESCE(json_extract(l.data,'$.deposit'),0) AS REAL)*100) AS INTEGER)=o.unit_deposit_amount
          AND julianday(o.ends_on)-julianday(o.starts_on)>=COALESCE(json_extract(l.data,'$.minimumRental'),1)*CASE o.billing_unit WHEN 'week' THEN 7 WHEN 'month' THEN 30 ELSE 1 END))
      AND ${capacitySQL('o','l',currentDay)})`;
  }
  const at=now(),other=seller?order.buyer_id:order.seller_id;
  const records=await ctx.db.batch([
    stmt(ctx.db,`UPDATE robot_orders AS o SET status=?,decision_note=?,updated_at=?,version=version+1
      WHERE id=? AND scope=? AND status=? AND version=? AND (buyer_id=? OR seller_id=?) ${condition}`,
      target,text(body.note,1000),at,key,ctx.scope,order.status,order.version,ctx.user.id,ctx.user.id),
    stmt(ctx.db,`INSERT INTO notifications(id,user_id,kind,data,created_at)
      SELECT ?,?,'robot-order',?,? WHERE changes()=1 AND EXISTS(SELECT 1 FROM users WHERE id=? AND notify_listings=1 AND deleted_at IS NULL)`,
      id(),other,JSON.stringify({order:key,listing:order.listing_id,kind:order.kind,status:target}),at,other)
  ]);
  if (!changes(records[0])) {
    const latest=await rawOrder(ctx,key);
    if (latest.status===target) return resultFor(ctx,key);
    fail(409,'Nie można potwierdzić zmiany. Sprawdź aktualny status, dane i opis sprzętu, cenę, termin i dostępną liczbę sztuk. Po zmianie danych sprzętu klient musi złożyć nowe zamówienie.',
      'The change could not be confirmed. Check the current status, equipment details and description, price, dates and available quantity. Changed equipment details require a new customer request.');
  }
  return resultFor(ctx,key);
}

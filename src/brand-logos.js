export const defaultHomeLogo = '07';
export const originalBrandLogo = 'original';
export const brandLogoIds = Array.from({length:20},(_,index)=>String(index+1).padStart(2,'0'));

export function brandLogoAsset(id) {
  return brandLogoIds.includes(id)?'/assets/brand-logos/'+id+'.webp':'';
}

export function isBrandLogo(id) {
  return id===originalBrandLogo||brandLogoIds.includes(id);
}

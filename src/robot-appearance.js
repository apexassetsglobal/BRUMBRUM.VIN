const escape = value => String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);

export const robotFrameColors = [
  ['#13c8ff','Cyjan','Cyan'],['#68ddff','Błękit','Sky blue'],['#1976ff','Niebieski','Blue'],
  ['#8454e8','Fiolet','Violet'],['#a646ff','Purpura','Purple'],['#ff28db','Magenta','Magenta'],
  ['#df48a7','Róż','Pink'],['#e84b55','Czerwień','Red'],['#ef8a25','Pomarańcz','Orange'],
  ['#ffb22e','Bursztyn','Amber'],['#caa520','Złoto','Gold'],['#ffe640','Żółty','Yellow'],
  ['#b3f529','Limonka','Lime'],['#20b67a','Zielony','Green'],['#70ffd0','Mięta','Mint'],
  ['#12a6a8','Turkus','Teal'],['#ffe4b0','Ciepła biel','Warm white'],['#e1f6ff','Zimna biel','Cool white']
];

export function robotFrameControls(ctx,group) {
  const t=ctx.t,name=escape(group+'-robot-frame');
  return `<section class="robot-frame-settings" aria-labelledby="${name}-title" data-robot-frame-settings>
    <h3 id="${name}-title">${t('Ramka i kolory LED','Frame & LED colors')}</h3>
    <p class="robot-frame-help">${t('Jedna ramka, wybrany kolor i siła świecenia. Podgląd zmienia się od razu.','One border with your choice of color and glow. The preview updates immediately.')}</p>
    <fieldset class="robot-frame-mode"><legend>${t('Rodzaj ramki','Frame style')}</legend>
      <label><input type="radio" name="${name}-mode" value="normal" data-robot-frame-control="mode"><span>${t('Zwykła','Standard')}</span><small>${t('Prosta ramka bez poświaty','A simple border without glow')}</small></label>
      <label><input type="radio" name="${name}-mode" value="neon" data-robot-frame-control="mode" checked><span>${t('LED / neon','LED / neon')}</span><small>${t('Pojedyncza ramka z poświatą','One border with a soft glow')}</small></label>
    </fieldset>
    <div class="robot-neon-options" data-robot-neon-options>
      <fieldset class="robot-frame-color"><legend>${t('Kolor LED','LED color')}</legend><div class="robot-frame-swatches">
        ${robotFrameColors.map(([value,pl,en],i)=>`<label class="robot-frame-swatch" style="--swatch:${value}"><input type="radio" name="${name}-color" value="${value}" data-robot-frame-control="color"${i===0?' checked':''}><span class="robot-frame-color-chip" aria-hidden="true"></span><span>${escape(t(pl,en))}</span></label>`).join('')}
      </div></fieldset>
      <fieldset class="robot-frame-custom"><legend>${t('Dowolny kolor i odcień','Any color or shade')}</legend><div class="robot-frame-custom-inputs">
        <label class="robot-frame-picker"><span>${t('Paleta','Palette')}</span><input type="color" value="#13c8ff" data-robot-frame-control="color" aria-label="${t('Wybierz dowolny kolor LED','Choose any LED color')}"></label>
        <label class="robot-frame-hex"><span>${t('Kod koloru HEX','HEX color code')}</span><input type="text" value="#13c8ff" maxlength="7" pattern="#[0-9a-fA-F]{6}" spellcheck="false" autocomplete="off" data-robot-frame-control="color" aria-describedby="${name}-color-error" aria-invalid="false"></label>
      </div><p class="robot-frame-color-error" id="${name}-color-error" data-robot-frame-color-error role="status" hidden>${t('Wpisz # i 6 znaków: 0–9 lub A–F, np. #13c8ff.','Enter # and 6 characters: 0–9 or A–F, e.g. #13c8ff.')}</p></fieldset>
      <label class="robot-frame-range"><span>${t('Siła poświaty','Glow intensity')} <output data-robot-frame-value="glow">60%</output></span><input type="range" min="0" max="100" step="1" value="60" data-robot-frame-control="glow"></label>
    </div>
    <label class="robot-frame-range"><span>${t('Grubość ramki','Border thickness')} <output data-robot-frame-value="width">2 px</output></span><input type="range" min="1" max="6" step="1" value="2" data-robot-frame-control="width"></label>
    <div class="robot-frame-preview" aria-label="${t('Podgląd wybranej ramki','Selected frame preview')}"><span class="robot-frame-preview-symbol" aria-hidden="true">R</span><div><strong>${t('Roboty i automatyka','Robots & automation')}</strong><span>${t('Tak będzie wyglądać Twoja ramka','This is how your frame will look')}</span></div></div>
    <div class="robot-frame-settings-end"><button type="button" class="btn" data-robot-frame-reset>${t('Przywróć niebieski LED','Restore the blue LED')}</button><p>${t('Ustawienia zapisują się w tej przeglądarce.','Settings are saved in this browser.')}</p></div>
  </section>`;
}

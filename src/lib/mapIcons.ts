import L from 'leaflet';

export const restaurantIcon = new L.DivIcon({
  html: `
    <div style="position:relative;width:48px;height:60px;transform-style:preserve-3d;">
      <style>
        @keyframes rooftop-spin-sm { 0%{transform:rotateY(0deg) rotateX(-20deg)} 100%{transform:rotateY(360deg) rotateX(-20deg)} }
        @keyframes ring-out-sm { 0%{transform:translate(-50%,-50%) scale(0.5);opacity:0.8} 100%{transform:translate(-50%,-50%) scale(2);opacity:0} }
        @keyframes float-label-sm { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-2px)} }
        @keyframes building-bob-sm { 0%,100%{transform:translate(-50%, 0)} 50%{transform:translate(-50%, -2px)} }
      </style>

      <!-- Pulsing rings at base -->
      <div style="position:absolute;left:50%;top:50px;width:24px;height:6px;border-radius:50%;background:rgba(249,115,22,0.2);transform:translate(-50%,-50%);animation:ring-out-sm 2s ease-out infinite 0s;"></div>
      <div style="position:absolute;left:50%;top:50px;width:24px;height:6px;border-radius:50%;background:rgba(249,115,22,0.2);transform:translate(-50%,-50%);animation:ring-out-sm 2s ease-out infinite 0.7s;"></div>

      <!-- Building wrapper -->
      <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);animation:building-bob-sm 3s ease-in-out infinite;">

        <!-- Building body -->
        <div style="
          width:36px;height:34px;
          background:linear-gradient(160deg,#fff8f0 0%,#ffe8cc 60%,#fed7aa 100%);
          border-radius:4px 4px 2px 2px;
          border:1px solid rgba(249,115,22,0.5);
          position:relative;
          box-shadow:2px 4px 0 rgba(234,88,12,0.2), 0 4px 12px rgba(249,115,22,0.25);
          overflow:hidden;
        ">
          <!-- Windows -->
          <div style="display:flex;gap:4px;padding:4px 4px 0;justify-content:center;">
            <div style="width:10px;height:8px;background:linear-gradient(135deg,#bae6fd,#7dd3fc);border-radius:1px;border:1px solid rgba(59,130,246,0.3);"></div>
            <div style="width:10px;height:8px;background:linear-gradient(135deg,#fde68a,#fbbf24);border-radius:1px;border:1px solid rgba(251,191,36,0.3);"></div>
          </div>
          <!-- Door -->
          <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:10px;height:12px;background:linear-gradient(180deg,#9a3412,#7c2d12);border-radius:2px 2px 0 0;"></div>
        </div>

        <!-- Side face (3D depth) -->
        <div style="
          position:absolute;top:2px;right:-6px;width:8px;height:34px;
          background:linear-gradient(180deg,#fed7aa,#fdba74);
          border-radius:0 2px 1px 0;
          box-shadow:1px 2px 0 rgba(234,88,12,0.15);
          transform:skewY(-1deg);
          border-right:1px solid rgba(249,115,22,0.3);
          border-top:1px solid rgba(249,115,22,0.2);
        "></div>

        <!-- Rooftop -->
        <div style="
          position:absolute;top:-10px;left:50%;transform:translateX(-50%);
          width:42px;height:12px;
          background:linear-gradient(135deg,#f97316,#ea580c);
          border-radius:3px 3px 1px 1px;
          box-shadow:0 -1px 6px rgba(249,115,22,0.4), 0 2px 4px rgba(234,88,12,0.3);
          display:flex;align-items:center;justify-content:center;
        ">
          <!-- Spinning pizza on rooftop -->
          <div style="font-size:10px;animation:rooftop-spin-sm 4s linear infinite;">🍕</div>
        </div>
      </div>

      <!-- Floating label ABOVE the building -->
      <div style="
        position:absolute;top:-22px;left:50%;
        background:white;
        color:#ea580c;font-size:10px;font-weight:800;
        padding:2px 8px;border-radius:12px;
        white-space:nowrap;letter-spacing:0.2px;
        box-shadow:0 2px 8px rgba(249,115,22,0.3);
        animation:float-label-sm 2.5s ease-in-out infinite;
        border:1px solid #fed7aa;
        display:flex;align-items:center;gap:3px;
      ">🍕 Olive Pizza</div>
    </div>
  `,
  className: '',
  iconSize: [48, 60],
  iconAnchor: [24, 60],
});

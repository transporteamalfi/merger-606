import React, { useState, useEffect } from "react";

// ── Catálogos Oficiales de la DGII (Nombres Largos) ────────────────────────
const TIPOS_BIENES = [
  { code: "01", label: "01 - GASTOS DE PERSONAL" },
  { code: "02", label: "02 - GASTOS POR TRABAJOS, SUMINISTROS Y SERVICIOS" },
  { code: "03", label: "03 - ARRENDAMIENTOS" },
  { code: "04", label: "04 - GASTOS DE ACTIVOS FIJOS" },
  { code: "05", label: "05 - GASTOS DE REPRESENTACIÓN" },
  { code: "06", label: "06 - OTRAS DEDUCCIONES ADMITIDAS" },
  { code: "07", label: "07 - GASTOS FINANCIEROS" },
  { code: "08", label: "08 - GASTOS EXTRAORDINARIOS" },
  { code: "09", label: "09 - COMPRAS Y GASTOS QUE FORMAN PARTE DEL COSTO DE VENTA" },
  { code: "10", label: "10 - ADQUISICIONES DE ACTIVOS" },
  { code: "11", label: "11 - GASTOS DE SEGUROS" },
];

const TIPOS_RETENCION = [
  { code: "01", label: "01 - ALQUILERES" },
  { code: "02", label: "02 - HONORARIOS POR SERVICIOS" },
  { code: "03", label: "03 - OTRAS RENTAS" },
  { code: "04", label: "04 - OTRAS RENTAS (RENTAS PRESUNTAS)" },
  { code: "05", label: "05 - INTERESES PAGADOS A PERSONAS JURÍDICAS" },
  { code: "06", label: "06 - INTERESES PAGADOS A PERSONAS FÍSICAS" },
  { code: "07", label: "07 - RETENCIÓN PROVEEDORES DEL ESTADO" },
  { code: "08", label: "08 - JUEGOS TELEFÓNICOS" },
];

const FORMAS_PAGO = [
  { code: "01", label: "01 - EFECTIVO" },
  { code: "02", label: "02 - CHEQUES / TRANSFERENCIAS / DEPÓSITO" },
  { code: "03", label: "03 - TARJETA CRÉDITO / DÉBITO" },
  { code: "04", label: "04 - COMPRA A CRÉDITO" },
  { code: "05", label: "05 - PERMUTA" },
  { code: "06", label: "06 - NOTAS DE CRÉDITO" },
  { code: "07", label: "07 - MIXTO" },
];

// ── Helpers de Formateo y Fecha ───────────────────────────────────────────
const normalize = (v) => (v == null ? "" : String(v).trim());

const getLabelFromCode = (list, val) => {
  if (!val) return "";
  const strVal = String(val).trim();
  if (strVal.includes(" - ")) return strVal;
  const cleanCode = strVal.split('-')[0].trim().replace(/^0+/, '').padStart(2, "0");
  const found = list.find(item => item.code === cleanCode);
  return found ? found.label : strVal;
};

const fmtNum = (v) => { 
  if (v == null || v === "") return "0.00";
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, '')); 
  return isNaN(n) ? "0.00" : n.toFixed(2); 
};

// Función para calcular fecha de pago automáticamente
const resolverFechaPago = (aaaamm, dd, formaPagoLabel) => {
  if (!aaaamm || !dd) return { m: "", d: "" };
  
  const code = formaPagoLabel.split(' - ')[0];
  
  // Pagos inmediatos (Efectivo, Cheque, Tarjeta)
  if (["01", "02", "03"].includes(code)) {
    return { m: aaaamm.split('.')[0], d: dd.split('.')[0].padStart(2, '0') };
  }

  // Compras a crédito (+30 días)
  if (code === "04") {
    try {
      const y = parseInt(aaaamm.substring(0, 4));
      const m = parseInt(aaaamm.substring(4, 6)) - 1; 
      const d = parseInt(dd);
      const date = new Date(y, m, d);
      date.setDate(date.getDate() + 30);
      
      const resY = date.getFullYear();
      const resM = String(date.getMonth() + 1).padStart(2, '0');
      const resD = String(date.getDate()).padStart(2, '0');
      
      return { m: `${resY}${resM}`, d: resD };
    } catch (e) {
      return { m: "", d: "" };
    }
  }

  return { m: "", d: "" };
};

// ── Lógica de Procesamiento ───────────────────────────────────────────────
function parseDGII(wb) {
  const XLSX = window.XLSX;
  const sheetName = wb.SheetNames.find(n => n.includes("606")) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  
  let hdrIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    if (rows[i] && rows[i].some(c => String(c).toUpperCase().includes("NCF"))) {
      hdrIdx = i;
      break;
    }
  }
  
  if (hdrIdx === -1) return [];

  const headers = rows[hdrIdx];
  const findCol = (keys) => headers.findIndex(h => h && keys.some(k => String(h).toLowerCase().includes(k.toLowerCase())));

  const C = {
    rnc: findCol(["RNC", "Cédula"]),
    tipoId: findCol(["Tipo ID"]),
    tipoBienes: findCol(["Bienes", "Tipo de Bienes"]),
    ncf: findCol(["NCF"]),
    ncfMod: findCol(["NCF Modificado", "NCF o Documento"]),
    fechaM: findCol(["Fecha Comprobante"]),
    fechaD: findCol(["Fecha Comprobante"]) + 1,
    mServ: findCol(["Monto Facturado en Servicios"]),
    mBienes: findCol(["Monto Facturado en Bienes"]),
    itbisF: findCol(["ITBIS Facturado"]),
    itbisR: findCol(["ITBIS Retenido"]),
    itbisProp: findCol(["ITBIS Sujeto a Proporcionalidad"]),
    itbisC: findCol(["ITBIS Llevado al Costo", "Costo"]),
    itbisA: findCol(["ITBIS por Adelantar", "Adelantar"]),
    tipoRet: findCol(["Retención ISR", "Tipo de Retención"]),
    montoRet: findCol(["Monto Retención"]),
    impSelectivo: findCol(["Impuesto Selectivo"]),
    otrosImp: findCol(["Otros Impuestos", "Tasas"]),
    propina: findCol(["Propina Legal"]),
    formaPago: findCol(["Forma de Pago"])
  };

  const records = [];
  for (let i = hdrIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const ncf = normalize(r[C.ncf]);
    if (ncf && ncf.length >= 9) {
      const fPagoLabel = getLabelFromCode(FORMAS_PAGO, r[C.formaPago]);
      const { m: fPagoM, d: fPagoD } = resolverFechaPago(normalize(r[C.fechaM]), normalize(r[C.fechaD]), fPagoLabel);

      records.push({
        rnc: normalize(r[C.rnc]),
        tipoId: normalize(r[C.tipoId]) || "1",
        tipoBienes: getLabelFromCode(TIPOS_BIENES, r[C.tipoBienes]),
        ncf,
        ncfModifica: normalize(r[C.ncfMod]),
        fechaCompM: normalize(r[C.fechaM]).split('.')[0],
        fechaCompD: normalize(r[C.fechaD]).split('.')[0],
        fechaPagoM: fPagoM,
        fechaPagoD: fPagoD,
        montoServ: fmtNum(r[C.mServ]),
        montoBienes: fmtNum(r[C.mBienes]),
        totalFacturado: fmtNum(parseFloat(r[C.mServ] || 0) + parseFloat(r[C.mBienes] || 0)),
        itbisFacturado: fmtNum(r[C.itbisF]),
        itbisRetenido: fmtNum(r[C.itbisR]),
        itbisProp: fmtNum(r[C.itbisProp]),
        itbisCosto: fmtNum(parseFloat(r[C.itbisC] || 0) + parseFloat(r[C.itbisA] || 0)), 
        itbisAdelantar: "0.00",
        tipoRet: getLabelFromCode(TIPOS_RETENCION, r[C.tipoRet]),
        montoRet: fmtNum(r[C.montoRet]),
        impSelectivo: fmtNum(r[C.impSelectivo]),
        otrosImp: fmtNum(r[C.otrosImp]),
        propina: fmtNum(r[C.propina]),
        formaPago: fPagoLabel,
        source: "DGII"
      });
    }
  }
  return records;
}

function parseAlegraAndMerge(wb, dgiiRecords = []) {
  const XLSX = window.XLSX;
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const HDR_IDX = 7;
  const headers = rows[HDR_IDX] || [];
  const ci = (substr) => headers.findIndex(h => h && String(h).toLowerCase().includes(substr.toLowerCase()));

  const COL = {
    rnc: ci("rnc/cedula"),
    tipoId: ci("tipo de identificación"),
    tipoBienes: ci("tipo de bienes"),
    ncf: ci("ncf"),
    ncfModifica: ci("ncf ó documento modificado"),
    fechaCompM: ci("fecha de comprobante (aaaamm)"),
    fechaCompD: ci("fecha de comprobante (d)"),
    totalFacturado: ci("total monto facturado"),
    itbisFacturado: ci("itbis facturado"),
    itbisCosto: ci("itbis llevado al costo"),
    itbisAdelantar: ci("itbis por adelantar"),
    tipoRet: ci("tipo de retención en isr"),
    montoRet: ci("monto retención renta"),
    formaPago: ci("forma de pago"),
    montoServ: ci("monto facturado en servicios"),
    montoBienes: ci("monto facturado en bienes"),
    itbisRetenido: ci("itbis retenido"),
    itbisProp: ci("itbis sujeto a proporcionalidad"),
    impSelectivo: ci("impuesto selectivo al consumo"),
    otrosImp: ci("otros impuestos/tasas"),
    propina: ci("monto propina legal")
  };

  const combined = [];
  const processedNCFs = new Set();

  for (let i = HDR_IDX + 1; i < rows.length; i++) {
    const row = rows[i];
    const ncf = normalize(row[COL.ncf]);
    if (!row || !ncf) continue;

    const dgiiMatch = dgiiRecords.find(d => d.ncf === ncf);
    const itbis15 = parseFloat(row[COL.itbisAdelantar] || 0);
    const itbis14 = parseFloat(row[COL.itbisCosto] || 0);
    
    const formaPago = dgiiMatch?.formaPago || getLabelFromCode(FORMAS_PAGO, row[COL.formaPago]);
    const { m: fPagoM, d: fPagoD } = resolverFechaPago(normalize(row[COL.fechaCompM]), normalize(row[COL.fechaCompD]), formaPago);

    combined.push({
      rnc: normalize(row[COL.rnc]),
      tipoId: normalize(row[COL.tipoId]) || "1",
      tipoBienes: dgiiMatch?.tipoBienes || getLabelFromCode(TIPOS_BIENES, row[COL.tipoBienes]),
      ncf,
      ncfModifica: normalize(row[COL.ncfModifica]),
      fechaCompM: normalize(row[COL.fechaCompM]).split('.')[0],
      fechaCompD: normalize(row[COL.fechaCompD]).split('.')[0],
      fechaPagoM: fPagoM,
      fechaPagoD: fPagoD,
      montoServ: fmtNum(row[COL.montoServ]),
      montoBienes: fmtNum(row[COL.montoBienes]),
      totalFacturado: fmtNum(row[COL.totalFacturado]),
      itbisFacturado: fmtNum(row[COL.itbisFacturado]),
      itbisRetenido: dgiiMatch?.itbisRetenido || fmtNum(row[COL.itbisRetenido]),
      itbisProp: dgiiMatch?.itbisProp || fmtNum(row[COL.itbisProp]),
      itbisCosto: fmtNum(itbis14 + itbis15), 
      itbisAdelantar: "0.00",
      tipoRet: dgiiMatch?.tipoRet || getLabelFromCode(TIPOS_RETENCION, row[COL.tipoRet]),
      montoRet: fmtNum(row[COL.montoRet]),
      impSelectivo: dgiiMatch?.impSelectivo || fmtNum(row[COL.impSelectivo]),
      otrosImp: dgiiMatch?.otrosImp || fmtNum(row[COL.otrosImp]),
      propina: dgiiMatch?.propina || fmtNum(row[COL.propina]),
      formaPago: formaPago,
      source: "Alegra"
    });
    processedNCFs.add(ncf);
  }

  dgiiRecords.forEach(d => {
    if (!processedNCFs.has(d.ncf)) combined.push(d);
  });

  return combined.sort((a, b) => {
    const dateA = parseInt(`${a.fechaCompM}${String(a.fechaCompD).padStart(2, '0')}`);
    const dateB = parseInt(`${b.fechaCompM}${String(b.fechaCompD).padStart(2, '0')}`);
    return dateA - dateB;
  });
}

// ── App Principal ──────────────────────────────────────────────────────────
export default function App() {
  const [dgiiData, setDgiiData] = useState([]);
  const [mergedData, setMergedData] = useState(null);
  const [rnc, setRnc] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [step, setStep] = useState(0); 
  const [libReady, setLibReady] = useState(false);

  useEffect(() => {
    if (window.XLSX) { setLibReady(true); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
    script.onload = () => setLibReady(true);
    document.head.appendChild(script);
  }, []);

  const handleDGII = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = window.XLSX.read(evt.target.result, { type: "array" });
      const records = parseDGII(wb);
      setDgiiData(records);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleAlegra = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = window.XLSX.read(evt.target.result, { type: "array" });
      const data = parseAlegraAndMerge(wb, dgiiData);
      setMergedData(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      rows.slice(0, 10).forEach(row => {
        if (!row) return;
        const r0 = normalize(row[0]).toLowerCase();
        if (r0.includes("rnc")) setRnc(normalize(row[1]));
        if (r0.includes("período")) setPeriodo(normalize(row[1]).split('.')[0]);
      });
      setStep(1);
    };
    reader.readAsArrayBuffer(file);
  };

  const exportFinal = () => {
    const XLSX = window.XLSX;
    // Las 26 columnas finales: Número Línea + 25 oficiales
    const headerRow = [
      "Número línea", "RNC/Cedula", "Tipo de identificación", "Tipo de bienes y servicios comprados", "NCF", "NCF ó documento modificado",
      "Fecha de comprobante (AAAAMM)", "Fecha de comprobante (D)", "Fecha de pago (AAAAMM)", "Fecha de pago (D)",
      "Monto facturado en servicios", "Monto facturado en bienes", "Total monto facturado",
      "ITBIS facturado", "ITBIS retenido", "ITBIS sujeto a proporcionalidad",
      "ITBIS llevado al costo", "ITBIS por adelantar", "ITBIS percibido en compras",
      "Tipo de retención en ISR", "Monto retención renta", "ISR percibido en compras",
      "Impuesto selectivo al consumo", "Otros impuestos/tasas", "Monto propina legal",
      "Forma de pago"
    ];

    const sheetData = [
      ["606 UNIFICADO Y PROCESADO"],
      ["RNC Informante:", rnc],
      ["Periodo Reportado:", periodo],
      ["Total Registros:", mergedData.length],
      [],
      headerRow,
      ...mergedData.map((r, i) => [
        i + 1, // Columna 0: Número línea
        r.rnc, r.tipoId, r.tipoBienes, r.ncf, r.ncfModifica,
        r.fechaCompM, r.fechaCompD, r.fechaPagoM || "", r.fechaPagoD || "",
        r.montoServ, r.montoBienes, r.totalFacturado,
        r.itbisFacturado, r.itbisRetenido, r.itbisProp || "0.00",
        r.itbisCosto, "0.00", "0.00", 
        r.tipoRet, r.montoRet, "0.00",
        r.impSelectivo || "0.00", r.otrosImp || "0.00", r.propina || "0.00", 
        r.formaPago
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "606_UNIFICADO");
    
    // Auto-ajuste básico de columnas
    ws["!cols"] = headerRow.map((_, idx) => ({ wch: idx === 3 ? 45 : (idx === 0 ? 10 : 20) }));

    XLSX.writeFile(wb, `606_FINAL_${periodo}.xlsx`);
  };

  if (!libReady) return <div className="p-20 text-center text-slate-400 font-mono">Iniciando motor Transporte Amalfi...</div>;

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-200 font-sans p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 text-center">
          <div className="bg-blue-600/20 text-blue-400 px-4 py-1 rounded-full inline-block text-xs font-bold mb-4 uppercase tracking-widest">
            Uso Exclusivo: Transporte Amalfi
          </div>
          <h1 className="text-4xl font-black text-white mb-3 tracking-tighter uppercase">606 Merger Pro 🚛</h1>
          <p className="text-slate-400 font-medium text-lg italic">Unificador inteligente de reportes DGII y Alegra.</p>
        </header>

        {step === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-in fade-in duration-500">
            <div className="bg-[#161b22] border border-slate-800 p-10 rounded-3xl flex flex-col items-center text-center shadow-2xl hover:border-blue-500/50 transition-all group">
              <div className="text-6xl mb-5 group-hover:scale-110 transition-transform duration-300">📊</div>
              <h2 className="text-2xl font-bold mb-3 text-white">1. Herramienta DGII (.xls)</h2>
              <p className="text-slate-400 mb-8 italic">Sube tu archivo actual para recuperar tus clasificaciones anteriores.</p>
              <label className={`w-full py-5 rounded-2xl border-2 border-dashed block cursor-pointer transition-all ${dgiiData.length > 0 ? 'border-green-500 bg-green-500/10 text-green-400' : 'border-slate-700 hover:border-slate-500 text-slate-500'}`}>
                <input type="file" className="hidden" onChange={handleDGII} accept=".xls,.xlsx" />
                <span className="font-bold text-lg">{dgiiData.length > 0 ? `✅ ${dgiiData.length} Facturas Cargadas` : "Cargar Archivo DGII"}</span>
              </label>
            </div>
            <div className="bg-[#161b22] border border-slate-800 p-10 rounded-3xl flex flex-col items-center text-center shadow-2xl hover:border-blue-500/50 transition-all group">
              <div className="text-6xl mb-5 group-hover:rotate-12 transition-transform duration-300">🚀</div>
              <h2 className="text-2xl font-bold mb-3 text-white">2. Reporte Alegra (.xlsx)</h2>
              <p className="text-slate-400 mb-8 italic">Sube Alegra para combinar todo y aplicar las reglas automáticas.</p>
              <label className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black block cursor-pointer transition-all shadow-xl text-center text-lg shadow-blue-900/20 uppercase">
                <input type="file" className="hidden" onChange={handleAlegra} accept=".xls,.xlsx" />
                Unificar y Procesar
              </label>
            </div>
          </div>
        )}

        {step === 1 && mergedData && (
          <div className="space-y-8 animate-in slide-in-from-bottom duration-700">
            <div className="bg-[#161b22] border border-slate-800 p-8 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl border-l-4 border-l-blue-500">
              <div className="flex gap-10">
                <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Empresa</p><p className="text-xl font-mono text-blue-400 font-bold">{rnc || "T. Amalfi"}</p></div>
                <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Periodo</p><p className="text-xl font-mono text-blue-400 font-bold">{periodo}</p></div>
                <div><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Facturas</p><p className="text-xl font-mono text-white font-bold">{mergedData.length}</p></div>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                <button onClick={() => setStep(0)} className="flex-1 md:flex-none text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-all">Reiniciar</button>
                <button onClick={exportFinal} className="flex-1 md:flex-none bg-green-600 hover:bg-green-500 text-white px-10 py-4 rounded-2xl font-black shadow-xl tracking-tight transition-all active:scale-95 text-lg shadow-green-900/20 uppercase">Descargar Excel Final</button>
              </div>
            </div>

            <div className="bg-[#161b22] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#0d1117] text-slate-500 z-10 border-b border-slate-800">
                    <tr>
                      <th className="p-5 font-black uppercase text-center w-12">#</th>
                      <th className="p-5 font-black uppercase">FECHA FACTURA</th>
                      <th className="p-5 font-black uppercase">NCF</th>
                      <th className="p-5 font-black uppercase text-blue-400">PAGO CALCULADO</th>
                      <th className="p-5 font-black uppercase text-orange-400 bg-orange-950/10">ITBIS COSTO (C14)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {mergedData.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="p-5 text-center text-slate-500 font-bold border-r border-slate-800/30">{i + 1}</td>
                        <td className="p-5 font-mono text-slate-400">{row.fechaCompD}/{row.fechaCompM.substring(4)}</td>
                        <td className="p-5 font-bold text-blue-100 tracking-tighter font-mono text-sm">{row.ncf}</td>
                        <td className="p-5 font-bold text-blue-400 font-mono">
                          {row.fechaPagoM ? `${row.fechaPagoD}/${row.fechaPagoM.substring(4)}` : "—"}
                        </td>
                        <td className="p-5 text-orange-400 font-bold bg-orange-400/5 font-mono text-sm tracking-tight">{row.itbisCosto}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-center text-slate-500 text-xs font-bold uppercase tracking-tighter opacity-60">
              ✨ Archivo optimizado con 26 columnas para carga masiva en la Oficina Virtual DGII.
            </p>
          </div>
        )}
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0d1117; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #30363d; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #484f58; }
      `}</style>
    </div>
  );
}

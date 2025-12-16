/**
 * Initial radar data from Pasta1.xlsx
 * Pre-loaded radars for BR-040
 */

const INITIAL_RADARES = [
    // RADARES PER (Ponto de Fiscalização Eletrônica de Velocidade)
    { km: "50+300", tipo: "PER", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "50+500", tipo: "PER", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "118+700", tipo: "PER", velocidade: 60, classificacao: "RCU", sentido: "", municipio: "" },
    { km: "118+800", tipo: "PER", velocidade: 60, classificacao: "RCU", sentido: "", municipio: "" },
    { km: "129+200", tipo: "PER", velocidade: 80, classificacao: "RCU", sentido: "", municipio: "" },
    { km: "129+300", tipo: "PER", velocidade: 80, classificacao: "RCU", sentido: "", municipio: "" },
    { km: "141+500", tipo: "PER", velocidade: 60, classificacao: "RCU", sentido: "", municipio: "" },
    { km: "145+100", tipo: "PER", velocidade: 60, classificacao: "RCU", sentido: "", municipio: "" },
    { km: "145+400", tipo: "PER", velocidade: 60, classificacao: "RCU", sentido: "", municipio: "" },
    { km: "245+250", tipo: "PER", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "246+300", tipo: "PER", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "276+250", tipo: "PER", velocidade: 60, classificacao: "RCU", sentido: "", municipio: "" },
    { km: "277+850", tipo: "PER", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "281+000", tipo: "PER", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "281+000", tipo: "PER", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "299+900", tipo: "PER", velocidade: 80, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "413+400", tipo: "PER", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "413+800", tipo: "PER", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "459+500", tipo: "PER", velocidade: 110, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "462+300", tipo: "PER", velocidade: 70, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "462+950", tipo: "PER", velocidade: 70, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "443+700", tipo: "PER", velocidade: 70, classificacao: "RCU", sentido: "", municipio: "", descricao: "REDUTOR" },
    { km: "282+500", tipo: "PER", velocidade: 60, classificacao: "RCU", sentido: "", municipio: "", descricao: "REDUTOR" },

    // RADARES EDUCATIVOS
    { km: "34+500", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "38+500", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "39+300", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "39+800", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "40+300", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "41+100", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "43+100", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "44+150", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "46+610", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "" },
    { km: "141+0", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "144+0", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "413+200", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "413+200", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "413+200", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "", municipio: "", descricao: "Trevo" },
    { km: "423+700", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "423+700", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "453+200", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "453+200", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "470+0", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "470+0", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "498+200", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "498+200", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "499+300", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "499+300", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "503+200", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "503+200", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "506+600", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "506+600", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "508+050", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "508+120", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "510+500", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "511+600", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "513+600", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "513+600", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "515+600", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "515+600", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "517+010", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "517+030", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "523+20", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "523+200", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "524+071", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" },
    { km: "524+653", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "529+667", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "532+600", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Norte", municipio: "" },
    { km: "532+600", tipo: "Educativo", velocidade: 60, classificacao: "RURAL", sentido: "Sul", municipio: "" }
];

/**
 * Load initial data into the database if empty
 */
async function loadInitialData() {
    try {
        const existingRadares = await db.getRadares();

        // Only load if database is empty
        if (existingRadares.length === 0) {
            console.log('Loading initial radar data from Pasta1.xlsx...');

            const radaresToImport = INITIAL_RADARES.map(r => ({
                km: r.km,
                rodovia: 'BR-040',
                sentido: r.sentido || '',
                velocidade: r.velocidade || 60,
                tipoVia: r.classificacao === 'RCU' ? 'rural-urbana' : 'rural',
                tipoRadar: r.tipo,
                municipio: r.municipio || '',
                descricao: r.descricao || '',
                status: 'pendente',
                photos: []
            }));

            await db.importRadares(radaresToImport);
            console.log(`Loaded ${radaresToImport.length} radars from initial data`);

            return radaresToImport.length;
        }

        return 0;
    } catch (error) {
        console.error('Error loading initial data:', error);
        return 0;
    }
}

// Export for use in app.js
window.loadInitialData = loadInitialData;
window.INITIAL_RADARES = INITIAL_RADARES;

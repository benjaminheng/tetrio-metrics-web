function onDocumentReady(fn) {
  if (document.readyState != 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

function getGamemode40lData() {
  return new Promise((resolve) => {
    Papa.parse("https://raw.githubusercontent.com/benjaminheng/tetrio-metrics-archive/master/gamemode_40l.csv", {
      download: true,
      header: true,
      dynamicTyping: true,
      complete: (results) => {
        resolve(results.data);
      },
      transformHeader: (header) => {
        if (header === "time_ms") {
          return "time";
        }
        return header;
      },
      transform: (value, header) => {
        if (header === "played_at") {
          return Math.floor(Date.parse(value)/1000);
        } else if (header === "time") {
          return value / 1000; // Transform from milliseconds to seconds
        }
        return value;
      },
    })
  });
}

async function main() {
  const data = await getGamemode40lData();
  console.log(data);
}

onDocumentReady(main)

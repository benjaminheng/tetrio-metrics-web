function onDocumentReady(fn) {
  if (document.readyState != 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

class Renderer {
  constructor() {
    this.rawData = null;
    this.data40lOverTime = [[], []];
  }

  async initData() {
    this.rawData = await this.getGamemode40lData();

    // Data is sorted by played_at descending. Iterate backwards because we
    // want to display the x-axis in ascending order instead.
    for (let i=this.rawData.length-1; i>=0; i--) {
      const v = this.rawData[i];
      this.data40lOverTime[0].push(v.played_at);
      this.data40lOverTime[1].push(v.time);
    }
  }

  getGamemode40lData() {
    return new Promise((resolve) => {
      Papa.parse("https://raw.githubusercontent.com/benjaminheng/tetrio-metrics-archive/master/gamemode_40l.csv", {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
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

  render40LOverTime() {
    const { spline } = uPlot.paths;
    let opts = {
      title: "40L performance over time",
      id: "40l-over-time-chart",
      width: 800,
      height: 300,
      scales: {
        x: {
          // evenly spaced distribution
          distr: 2,
        },
      },
      axes: [
        {},
        {
          values: (u, vals, space) => vals.map(v => v + 's'),
        },
      ],
      series: [
        {
          label: "Date",
        },
        {
          show: true,
          label: "Time",
          value: (self, rawValue) => rawValue + "s",
          stroke: "red",
          width: 1,
          drawStyle: null,
          paths: spline(),
        }
      ],
    };
    let uplot = new uPlot(opts, this.data40lOverTime, document.getElementById("40l-over-time-container"));
  }

  renderTotalGamesPlayed() {
    document.getElementById("total-games-played").innerHTML = this.rawData.length;
  }
}

async function main() {
  const renderer = new Renderer();
  await renderer.initData();
  renderer.render40LOverTime();
  renderer.renderTotalGamesPlayed();
}

onDocumentReady(main)

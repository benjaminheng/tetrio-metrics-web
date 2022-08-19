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
    this.data40lOverGamesPlayed = [[], []];
  }

  async initData() {
    this.rawData = await this.getGamemode40lData();
    for (let i=0; i<this.rawData.length; i++) {
      const v = this.rawData[i];
      this.data40lOverTime[0].push(v.played_at);
      this.data40lOverTime[1].push(v.time);
      this.data40lOverGamesPlayed[0].push(i+1);
      this.data40lOverGamesPlayed[1].push(v.time);
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
    let opts = {
      title: "40L performance over time",
      id: "40l-over-time-chart",
      width: 800,
      height: 300,
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
        }
      ],
    };
    let uplot = new uPlot(opts, this.data40lOverTime, document.getElementById("40l-over-time-container"));
  }

  render40LOverGamesPlayed() {
    const { spline } = uPlot.paths;
    let opts = {
      title: "40L performance over games played",
      id: "40l-over-games-played-chart",
      width: 800,
      height: 300,
      scales: {
        x: {
          time: false,
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
          label: "Game number",
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

    let uplot = new uPlot(opts, this.data40lOverGamesPlayed, document.getElementById("40l-over-games-played-container"));
  }
}

async function main() {
  const renderer = new Renderer();
  await renderer.initData();
  renderer.render40LOverTime();
  renderer.render40LOverGamesPlayed();
}

onDocumentReady(main)

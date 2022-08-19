function onDocumentReady(fn) {
  if (document.readyState != 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

class Renderer {
  constructor() {
    // CSV data
    this.gamemode40lData = null;
    this.legacyGamemode40lData = null;

    // Chart data
    this.data40lOverTime = [[], []];
    this.dataPersonalBests = [[], []];

    // Other derived data
    this.top10Times = [];
  }

  async initGamemode40lData() {
    this.gamemode40lData = await this.getGamemode40lData();

    // Data is sorted by played_at descending. Iterate backwards because we
    // want to display the x-axis in ascending order instead.
    for (let i=this.gamemode40lData.length-1; i>=0; i--) {
      const v = this.gamemode40lData[i];
      this.data40lOverTime[0].push(v.played_at);
      this.data40lOverTime[1].push(v.time);
    }

    // Compute top 10 times
    const gamemode40lDataClone = [...this.gamemode40lData];
    gamemode40lDataClone.sort((a, b) => a.time - b.time);
    this.top10Times = gamemode40lDataClone.slice(0, 10);
  }

  async initLegacyGamemode40lData() {
    this.legacyGamemode40lData = await this.getLegacyGamemode40lData();

    let best = null;

    // Process legacy data, from before we started collecting data using
    // tetrio-metrics.
    if (this.legacyGamemode40lData.length > 0) {
      // Data is sorted by played_at descending. Iterate backwards because we
      // want to display the x-axis in ascending order instead.
      for (let i=this.legacyGamemode40lData.length-1; i>=0; i--) {
        const v = this.legacyGamemode40lData[i];
        this.dataPersonalBests[0].push(v.played_at);
        this.dataPersonalBests[1].push(v.time);
      }
      best = this.legacyGamemode40lData[0];
    }

    // Add personal bests from collected data using tetrio-metrics.
    for (let i=this.gamemode40lData.length-1; i>=0; i--) {
      const v = this.gamemode40lData[i];
      if (v.time < best) {
        this.dataPersonalBests[0].push(v.played_at);
        this.dataPersonalBests[1].push(v.time);
        best = v.time
      }
    }
  }

  getLegacyGamemode40lData() {
    return new Promise((resolve) => {
      Papa.parse("https://raw.githubusercontent.com/benjaminheng/tetrio-metrics-archive/master/gamemode_40l_legacy.csv", {
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

  render40LOverTimeChart() {
    const { spline } = uPlot.paths;
    let opts = {
      title: "40L performance over time",
      id: "40l-over-time-chart",
      width: 800,
      height: 250,
      scales: {
        x: {
          // evenly spaced distribution
          distr: 2,
        },
      },
      axes: [
        {},
        {
          values: (u, vals, space) => vals.map(v => this.prettifySeconds(v)),
        },
      ],
      series: [
        {
          label: "Date",
        },
        {
          show: true,
          label: "Time",
          value: (self, rawValue) => this.prettifySeconds(rawValue),
          stroke: "red",
          width: 1,
          drawStyle: null,
          paths: spline(),
        }
      ],
    };

    // Remove loading indicator before rendering
    document.getElementById("40l-over-time-container").innerHTML = "";
    let uplot = new uPlot(opts, this.data40lOverTime, document.getElementById("40l-over-time-container"));
  }

  renderPersonalBestsChart() {
    const { stepped } = uPlot.paths;
    let opts = {
      title: "40L personal bests over time",
      id: "40l-personal-bests-chart",
      width: 600,
      height: 250,
      axes: [
        {},
        {
          values: (u, vals, space) => vals.map(v => this.prettifySeconds(v)),
          size: 60,
        },
      ],
      series: [
        {
          label: "Date",
        },
        {
          show: true,
          label: "Time",
          value: (self, rawValue) => this.prettifySeconds(rawValue),
          stroke: "red",
          width: 1,
          drawStyle: null,
          paths: stepped({align: 1}),
        }
      ],
    };

    // Remove loading indicator before rendering
    document.getElementById("40l-personal-bests-container").innerHTML = "";
    let uplot = new uPlot(opts, this.dataPersonalBests, document.getElementById("40l-personal-bests-container"));
  }

  renderTotalGamesPlayed() {
    document.getElementById("total-games-played").innerHTML = this.gamemode40lData.length;
  }

  renderTop10Table() {
    const tbody = document.querySelector("table#top-10-table tbody")
    let content = "";
    for (const v of this.top10Times) {
      content += `<tr><td>${this.formatDate(v.played_at)}</td><td>${this.prettifySeconds(v.time)}</td></tr>`;
    }
    tbody.innerHTML = content;
  }

  prettifySeconds(seconds) {
    if (seconds <= 60) {
      return `${seconds}s`
    }
    const minutes = Math.floor(seconds / 60);
    const remainderSeconds = parseFloat((seconds % 60).toFixed(2));
    return `${minutes}m${remainderSeconds}s`
  }

  formatDate(epochSeconds) {
    const d = new Date(epochSeconds * 1000);
    // date formatting in JS is horrible
    return (
      d.getFullYear()
      + "-"
      + ("0"+(d.getMonth()+1)).slice(-2)
      + "-"
      + ("0" + d.getDate()).slice(-2)
      + " "
      + ("0" + d.getHours()).slice(-2)
      + ":"
      + ("0" + d.getMinutes()).slice(-2)
    );
  }
}

async function main() {
  const renderer = new Renderer();
  await renderer.initGamemode40lData().then(() => {
    renderer.render40LOverTimeChart();
    renderer.renderTotalGamesPlayed();
    renderer.renderTop10Table();
  });
  await renderer.initLegacyGamemode40lData().then(() => {
    renderer.renderPersonalBestsChart();
  });
}

onDocumentReady(main)

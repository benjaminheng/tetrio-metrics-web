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
    this.data40lPerformanceDistribution = [[], []];

    // Other derived data
    this.top10Times = [];

    // Colors
    this.colorPalette = {
      red: "#FF0000",
    }

    // Updates the default time format from MM/DD to DD/MM.
    this.timeFormats = [
      // tick incr          default           year                             month    day                        hour     min                sec       mode
      [3600 * 24 * 365,   "{YYYY}",         null,                            null,    null,                      null,    null,              null,        1],
      [3600 * 24 * 28,    "{MMM}",          "\n{YYYY}",                      null,    null,                      null,    null,              null,        1],
      [3600 * 24,         "{D}/{M}",        "\n{YYYY}",                      null,    null,                      null,    null,              null,        1],
      [3600,              "{h}{aa}",        "\n{D}/{M}/{YY}",                null,    "\n{D}/{M}",               null,    null,              null,        1],
      [60,                "{h}:{mm}{aa}",   "\n{D}/{M}/{YY}",                null,    "\n{D}/{M}",               null,    null,              null,        1],
      [1,                 ":{ss}",          "\n{D}/{M}/{YY} {h}:{mm}{aa}",   null,    "\n{D}/{M} {h}:{mm}{aa}",  null,    "\n{h}:{mm}{aa}",  null,        1],
      [0.001,             ":{ss}.{fff}",    "\n{D}/{M}/{YY} {h}:{mm}{aa}",   null,    "\n{D}/{M} {h}:{mm}{aa}",  null,    "\n{h}:{mm}{aa}",  null,        1],
    ];
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
    const sortedGamemode40lData = [...this.gamemode40lData];
    sortedGamemode40lData.sort((a, b) => a.time - b.time);
    this.top10Times = sortedGamemode40lData.slice(0, 10);

    // Compute 40L histogram data
    this.compute40lPerformanceDistributionData(sortedGamemode40lData);
  }

  compute40lPerformanceDistributionData(sortedGamemode40lData) {
    if (sortedGamemode40lData.length === 0) {
      return
    }
    const today = new Date();
    const dateThreshold = (24*60*60*1000) * 90; // 3 months in milliseconds

    // Initialize buckets
    const min = parseInt(sortedGamemode40lData[0].time);
    let max = parseInt(sortedGamemode40lData[sortedGamemode40lData.length-1].time);
    if (max > 75) {
      max = 75;
    }
    const numBuckets = max-min+1
    const bucketValues = Array.from({length: numBuckets}, () => 0)
    const buckets = Array.from({length: numBuckets}, (_, i) => i+min)

    // Build chart data
    let currentBucket = min;
    for (const v of sortedGamemode40lData) {
      if (v.time > max) {
        // Set upper bound on our histogram
        continue;
      } else if (today - (v.played_at*1000) > dateThreshold) {
        // Filter for games in the last 3 months
        continue
      }
      const bucketIndex = parseInt(v.time) - min;
      bucketValues[bucketIndex]++;
    }
    this.data40lPerformanceDistribution = [buckets, bucketValues];
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
      best = this.legacyGamemode40lData[0].time;
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
        {
          values: this.timeFormats,
        },
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
          stroke: this.colorPalette.red,
          fill: this.colorPalette.red + "1A",
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
    let opts = {
      title: "40L personal bests",
      id: "40l-personal-bests-chart",
      width: 600,
      height: 250,
      axes: [
        {
          values: this.timeFormats,
        },
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
          stroke: this.colorPalette.red,
          fill: this.colorPalette.red + "1A",
          width: 1,
          drawStyle: null,
        }
      ],
    };

    // Remove loading indicator before rendering
    document.getElementById("40l-personal-bests-container").innerHTML = "";
    let uplot = new uPlot(opts, this.dataPersonalBests, document.getElementById("40l-personal-bests-container"));
  }

  render40LPerformanceDistribution() {
    const { bars } = uPlot.paths;
    let opts = {
      title: "40L performance distribution (last 90 days)",
      id: "40l-performance-distribution-chart",
      width: 800,
      height: 250,
      scales: {
        x: {
          time: false,
          auto: false,
        },
      },
      axes: [
        {
          values: (u, vals, space) => vals.map(v => v + "s"),
        },
        {},
      ],
      series: [
        {
          label: "Time",
          value: (self, rawValue) => rawValue + "s",
        },
        {
          show: true,
          label: "Count",
          points: {
            show: false,
          },
          stroke: this.colorPalette.red,
          fill: this.colorPalette.red + "4c", // 30% transparency
          width: 1,
          drawStyle: null,
          paths: bars({
            align: 1,
            size: [1, Infinity],
            gap: 4}
          ),
        }
      ],
    };

    // Remove loading indicator before rendering
    document.getElementById("40l-performance-distribution-container").innerHTML = "";
    let uplot = new uPlot(opts, this.data40lPerformanceDistribution, document.getElementById("40l-performance-distribution-container"));
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

  renderRecentGamesTable() {
    const tbody = document.querySelector("table#recent-games-table tbody")
    let content = "";
    for (const v of this.gamemode40lData.slice(0, 5000)) {
      content += `<tr>
        <td>${this.formatDate(v.played_at)}</td>
        <td>${v.time.toFixed(3)}</td>
        <td>${v.finesse_percent.toFixed(2)}%</td>
        <td>${v.total_pieces}</td>
        <td>${v.pieces_per_second.toFixed(2)}</td>
        </tr>`;
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
    renderer.render40LPerformanceDistribution();
  });
  await renderer.initLegacyGamemode40lData().then(() => {
    renderer.renderPersonalBestsChart();
  });
}

async function recentPage() {
  const renderer = new Renderer();
  await renderer.initGamemode40lData().then(() => {
    renderer.renderRecentGamesTable();
  });
}

// The main js file to be executed in the client's browser

var dims = {
  width: $(window).width(),
  height: $(window).height(),
  margins: {
    top: 10,
    bottom: 10,
    left: 10,
    right: 10
  }
}

var worldJson = 'data/ne_110m_land.json';

// // Socket.io
// var socket = io.connect("/");
//
// socket.on("connect", function(){
//     console.log("Browser connected!")
// });
//
// socket.on('dem-success',(refToDEMonServer) => {
//   promptDEMdownload(refToDEMonServer);
// });

// D3 geo - let's make maps
// Mike Bostock is a 👑

var fleetData,
  raceBBox,
  raceFinish,
  raceScale,
  raceTranslate,
  fleetTracks,
  fleetPositions,
  mapContent;


var proj = d3.geoOrthographic();
// .center([-70, 50]);


var graticule = d3.geoGraticule();
var path = d3.geoPath(proj);
// .zoom(9);

var worldmap = d3.select('#world')
  .attr('viewbox', function() {
    return '0 0 ' + dims.width + ' ' + dims.height
  });

var worldg = worldmap.append('g').classed('worldg', true);

var fleetJsonPath = 'data/eastNA-metadata.json'

d3.queue() // from https://github.com/d3/d3-queue
  .defer(loadWorld, worldJson)
  .defer(loadFleetData, fleetJsonPath)
  .await(function(error, world, fleet) {
    if (error) throw error;
    console.log('WORLD', world);
    console.log('FLEET', fleet);
  });


function loadWorld(jsonPath) {
  d3.json(jsonPath, (data) => {

    // Draw geometries, assigning each element appropriate attributes
    // based on metadata contained in geojson
    worldg.selectAll('path')
      .data(data.features)
      .enter()
      .append('path')
      .attr('d', path)
      .attr('class', 'geography');

    // then draw graticules over geography
    worldg.append('path')
      .datum(graticule)
      .attr('class', 'graticule')
      .attr('d', path);
  });
}

var fleetMap = worldmap.append('g')
  .classed('fleet', true);




function loadFleetData(jsonPath) {
  d3.json(jsonPath, (fleet) => {
    // console.log(fleet);
    fleetData = fleet,
      raceBBox = d3.geoBounds(fleetData),
      raceFinish = fleet.metadata.finish;

    var timestampList = fleetData.features[0].properties.timestamps;
    fleetData.dates = timestampList.map((ts) => {
      return new Date(ts * 1000)
    });
    // proj.center(raceFinish);
    //
    // raceScale = 0.95 / Math.max((raceBBox[1][0] - raceBBox[0][0]) / dims.width, (raceBBox[1][1] - raceBBox[0][1]) / dims.height), // from https://bl.ocks.org/mbostock/4707858
    // raceTranslate = [(dims.width - raceScale * (raceBBox[1][0] + raceBBox[0][0])) / 2, (dims.height - raceScale * (raceBBox[1][1] + raceBBox[0][1])) / 2];

    // console.log(fleetData, raceBBox, raceFinish);

    fleetMap.append('g').classed('fleet-routes', true)
      .selectAll('path')
      .data(fleetData.features)
      .enter()
      .append('path')
      .attr('d', path)
      .attr('class', function(d) {
        // console.log(d);
        return d.properties['team-id'] + " route";
      });

    fleetTracks = fleetMap.append('g').classed('fleet-tracks', true)
      .selectAll('path')
      .data(fleetData.features)
      .enter()
      .append('path')
      .attr('d', path)
      .attr('class', function(d) {
        // console.log(d);
        return d.properties['team-id'] + " track";
      });

    fleetPositions = fleetMap.append('g').classed('fleet-positions', true)
      .selectAll('polygon')
      .data(fleetData.features)
      .enter()
      .append('polygon')
      .attr('class', function(d) {
        return d.properties['team-id'];
      })
      .attr('points', '0,15 -5,-5 5,-5');


    mapContent = fleetMap.append('g').classed('map-content', true)
      .selectAll('text')
      .data(fleetData.metadata.newDays)
      .enter();

    mapContent
      .append('text')
      .text((d) => {
              return fleetData.dates[d].toDateString();
            })
      .attr('x', (d) => {
        return proj(fleetData.metadata.fleetCentroids[d])[0] + 310;
      })
      .attr('y', (d) => {
        return proj(fleetData.metadata.fleetCentroids[d])[1] + 3;
      });

    mapContent
      .append('line')
      .attr('x1', (d) => {
        return proj(fleetData.metadata.fleetCentroids[d])[0] + 50;
      })
      .attr('y1', (d) => {
        return proj(fleetData.metadata.fleetCentroids[d])[1];
      })
      .attr('x2', (d) => {
        return proj(fleetData.metadata.fleetCentroids[d])[0] + 300;
      })
      .attr('y2', (d) => {
        return proj(fleetData.metadata.fleetCentroids[d])[1];
      })
      .attr('stroke', 'black')


    updateFleet(0);
    updateContent(fleetData.metadata.raceID);
  })

}





// http://bl.ocks.org/jcdcodes/b08e43600afc20017b99

function updateFleet(_index) {

  var fleetCentroid = fleetData.metadata.fleetCentroids[_index];

  proj
    .rotate([-1 * fleetCentroid[0], -1.7 * fleetCentroid[1]]);

  proj.scale(1500);

  d3.selectAll('path')
    .attr('d', path);

  fleetPositions
    .attr('transform', function(d) {
      var xy = proj(d.geometry.coordinates[_index])
      var bearing = turf.bearing(
        turf.point(d.geometry.coordinates[_index]),
        turf.point(d.geometry.coordinates[_index + 1])
      );

      return "rotate(" + String(bearing + 180) + ' ' + xy[0] + ' ' + xy[1] + ") translate(" + xy[0] + ',' + xy[1] + ') scale(0.8)';
    });

  fleetTracks
    .attr('d', function(d, i) {
      // console.log('D', d);
      return path({
        type: "LineString",
        coordinates: d.geometry.coordinates.slice(0, _index)
      });
    });

  mapContent.selectAll('text')
    .attr('x', (d) => {
      return proj(fleetData.metadata.fleetCentroids[d])[0] + 310;
    })
    .attr('y', (d) => {
      return proj(fleetData.metadata.fleetCentroids[d])[1] + 3;
    })
    .on('click', (d) => {
      updateFleet(d);
    })


  mapContent.selectAll('line')
    .attr('x1', (d) => {
      return proj(fleetData.metadata.fleetCentroids[d])[0] + 50;
    })
    .attr('y1', (d) => {
      return proj(fleetData.metadata.fleetCentroids[d])[1];
    })
    .attr('x2', (d) => {
      return proj(fleetData.metadata.fleetCentroids[d])[0] + 300;
    })
    .attr('y2', (d) => {
      return proj(fleetData.metadata.fleetCentroids[d])[1];
    });


}

function updateContent(_raceID) {
  // refactor to fetch _raceID appropriate data
  var raceContent = fleetData;
  // update header
  d3.select('#race-title')
    .text(fleetData.metadata.raceName);

  // var start = new Date(fleetData.metadata.timestamps[0]).format(....),
  //   end = new Date(fleetData.metadata.timestamps[fleetData.metadata.timestamps.length - 1]).format(......);

  d3.select('#race-dates')
    .text("Dates will go here start + ' - ' + end");
}



// from https://stackoverflow.com/questions/47917730/d3-line-and-points-on-map-from-csv-data
// var track = map.append('g')
//   .classed('track', true);
//
// track.selectAll('circle')
//   .data(data)
//   .enter()
//   .append('circle')
// //  .transition().duration(function (d, i) {return i; })
//   .attr('cx', function (d) {
//     return proj([d.lon, d.lat])[0]; })
//   .attr('cy', function (d) { return proj([d.lon, d.lat])[1]; })
//   .attr('r', 1)
//   .attr('class', function (d) {
//     var teamClass = d.team.replace('.', 'dot').toLowerCase().split(' ').join('-')
//     return teamClass;
//   });
// .transition();
// .attr('fill', 'green');

// EVENT LISTENERS:

// A snazzy little helper function for smooth jQuery scrolling from
// https://stackoverflow.com/questions/2346011/how-do-i-scroll-to-an-element-within-an-overflowed-div
// - thanks @lepe!!!!
jQuery.fn.scrollTo = function(elem, speed) {
  $(this).animate({
    scrollTop: $(this).scrollTop() - $(this).offset().top + $(elem).offset().top
  }, speed == undefined ? 1000 : speed);
  return this;
};

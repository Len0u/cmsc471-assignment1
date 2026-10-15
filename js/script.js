const margin = { top: 80, right: 60, bottom: 60, left: 100 };
const width = 800 - margin.left - margin.right;
const height = 600 - margin.top - margin.bottom;

let allData = []
const parseDate = d3.timeParse("%Y%m%d");

let xVar = 'Month', yVar = 'Precipitation', filterVar= 'Year', targetYear = 2017, targetMonth = 1 //for january
let xScale, yScale, sizeScale
const yOptions = ['Precipitation', 'Snow'] // xVar option includes the list of months or month date range
const filterOptions = ['Year', 'Months']  // if filtering by month then xVar are the individual dates

const xVarByFilter = { Year: 'Month', Months: 'Day' };
const weatherKeys = { Precipitation: "precipitation", Snow: "snow" };

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun","Jul", "Aug", "Sep"];
const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

const regionByState = {
    CT:'Northeast', ME:'Northeast', MA:'Northeast', NH:'Northeast', RI:'Northeast', VT:'Northeast', NJ:'Northeast', NY:'Northeast', PA:'Northeast',
    IL:'Midwest', IN:'Midwest', MI:'Midwest', OH:'Midwest', WI:'Midwest', IA:'Midwest', KS:'Midwest', MN:'Midwest', MO:'Midwest', NE:'Midwest', ND:'Midwest', SD:'Midwest',
    DE:'South', FL:'South', GA:'South', MD:'South', NC:'South', SC:'South', VA:'South', WV:'South', AL:'South', KY:'South', MS:'South', TN:'South', AR:'South', LA:'South', OK:'South', TX:'South',
    AZ:'West', CO:'West', ID:'West', MT:'West', NV:'West', NM:'West', UT:'West', WY:'West', AK:'West', CA:'West', HI:'West', OR:'West', WA:'West',
};
function regionOf(state){
    return regionByState[state] || 'Other'; // Canadian provinces & US territories bucket here
}

let viewLevel = 'region'; // 'region' | 'state'
let activeRegion = null;
let selectedState = null;
const t = 1000; // 1000ms = 1 second
let size = 10;  // Size of the legend squares
let label;


function aggregateData(mode, filter){
    const weatherType = weatherKeys[mode];
    const scopedData = viewLevel === 'state'
        ? allData.filter(d => regionOf(d.state) === activeRegion)
        : allData;
    const groupKey = viewLevel === 'state' ? (d => d.state) : (d => regionOf(d.state));

    if (filter == "Year"){
        // full year view
        const fullYearView = d3.rollup(
            scopedData,
            v => d3.sum(v, d => d[weatherType]),
            groupKey,
            d => d.date.getMonth()
        );

        return fullYearView
    }
    else if (filter == "Months") {
        const currentData = scopedData.filter(d =>
            d.date.getMonth() + 1 === targetMonth
        );
        // Month view
        const monthlyView = d3.rollup(
            currentData,
            v => d3.sum(v, d => d[weatherType]),
            groupKey,
            d => d.date.getDate()
        );

        return monthlyView
    }
}


// Create SVG
const svg = d3.select('#vis')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

// Zoom & pan on the chart
const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .on('zoom', (event) => {
        svg.attr('transform',
            `translate(${margin.left + event.transform.x},${margin.top + event.transform.y}) scale(${event.transform.k})`
        );
    });

d3.select('#vis svg').call(zoom);

function init(){
    d3.csv("./weather.csv", 
    function(d){
        return {  
        date: parseDate(d.date),
        precipitation: +d.PRCP, 
        snow: +d.SNOW, 
        station: d.station,
        state: d.state,
        }
    })
    .then(data => {
            console.log(data[0])
            allData = data
            setupSelector()
            updateVis()
            // addLegend()
        })
    .catch(error => console.error('Error loading data:', error));
}


function setupSelector(){
    let slider = d3
        .sliderHorizontal()
        .min(1)
        .max(10)
        .step(1)
        .width(width)
        .displayValue(true)
        .tickFormat(d => d3.timeFormat("%b")(
            new Date(2017, d - 1, 1)
        ))
        .default(1)
        .on('onchange', (val) => {
            targetMonth = +val;
            updateVis();
        });


    d3.select('#slider')
        .append('svg')
        .attr('width', width)
        .attr('height', 100)
        .append('g')
        .attr('transform', 'translate(30,30)')
        .call(slider);
    
    d3.select('#slider').style('display', 'none');
 
    d3.select('.filter')
        .each(function() {
            d3.select(this).selectAll('myOptions')
            .data(filterOptions)
            .enter()
            .append('option')
            .text(d => d) // The displayed text
            .attr("value",d => d) // The actual value used in the code
        })
        .on("change", function (event) {
            filterVar = d3.select(this).property("value");
            xVar = xVarByFilter[filterVar];

            if (filterVar == "Months"){
                d3.select('#slider').style('display', 'block');
            }
            else if (filterVar == "Year"){
                d3.select('#slider').style('display', 'none');
            }

            updateVis();
        })

    d3.select('.variable')
        .each(function() {
            d3.select(this).selectAll('myOptions')
            .data(yOptions)
            .enter()
            .append('option')
            .text(d => d) // The displayed text
            .attr("value",d => d) // The actual value used in the code
        })
        .on("change", function (event) {
            console.log(d3.select(this).property("value")) // Logs the selected value
            yVar = d3.select(this).property("value");
            updateVis();
        })


    d3.select('#filter').property('value', filterVar)
    d3.select('#yVariable').property('value', yVar)

    xVar = xVarByFilter[filterVar];

    if (filterVar == "Year"){
        d3.select('#slider').style('display', 'none');
    }
    else {
        d3.select('#slider').style('display', 'block');
    }

    d3.select('#backToRegions').on('click', () => {
        viewLevel = 'region';
        activeRegion = null;
        selectedState = null;
        d3.select('#backToRegions').style('display', 'none');
        updateVis();
    });
}
function getDaysInMonth(month, year = targetYear) {
    return new Date(year, month, 0).getDate();
}

function updateAxes(flat){
    svg.selectAll('.axis').remove()
    svg.selectAll('.labels').remove()

    let xValues;
    if (filterVar === "Year"){
        xValues = monthNames
    }
    else {
        xValues = Array.from(
        { length: getDaysInMonth(targetMonth) },
        (_, i) => i + 1
        );
    }

    xScale = d3.scaleBand()
        .domain(xValues)
        .range([0, width])
        .padding(0.1);

    const xAxis = d3.axisBottom(xScale);

    

    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${height})`) // Position at the bottom
        .call(xAxis);

    yScale = d3.scaleLinear()
        .domain([0, d3.max(flat, d => d.value) || 0])
        .range([height, 0]);
    const yAxis = d3.axisLeft(yScale)
    svg.append("g")
        .attr("class", "axis")
        .call(yAxis);

    // X-axis label
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + margin.bottom - 20)
        .attr("text-anchor", "middle")
        .text(xVar) // Displays the current x-axis variable
        .attr('class', 'labels')
        

    // Y-axis label (rotated)
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -margin.left + 20)
        .attr("text-anchor", "middle")
        .text(yVar)
        .attr('class', 'labels')
}

function updateVis(){
    const result = aggregateData(yVar, filterVar);

    const flat = Array.from(result, ([state, byDate]) =>
        Array.from(byDate, ([period, value]) => ({ 
            state, 
            date: filterVar === "Year"
                ? monthNames[period]
                : period, 
            value 
        }))
    ).flat();

    updateAxes(flat);

    const byState = d3.group(flat, d => d.state);
    const line = d3.line()
        .defined(d => d.value != null)
        .x(d => xScale(d.date) + xScale.bandwidth() / 2)
        .y(d => yScale(d.value));

    svg.selectAll('.line')
        .data(byState, ([state]) => state)
        .join('path')
        .attr('class', 'line')
        .attr('fill', 'none')
        .attr('stroke', ([state]) => colorScale(state))
        .attr('stroke-width', ([state]) => {
            if (state === selectedState){
                return 3;
            }
            return 1.5
        })
        .attr('opacity', ([state]) => {
            if (selectedState === null || state === selectedState ){
                return 1;
            }
            return 0.15;
        })
        .style('cursor', 'pointer')
        .on('click', (event, [state]) => handleEntityClick(state))
        .on('mouseover', function (event, [state, values]) {
            d3.select(this) // Refers to the hovered line
                .style('stroke', 'black')
                .style('stroke-width', '3px');
        })
        .on('mousemove', function (event, [state, values]) {
            const [mx] = d3.pointer(event);
            const domainValue = xScale.domain()[Math.floor(mx / xScale.step())];
            const point = values.find(v => v.date === domainValue);

            d3.select('#tooltip')
                .style('display', 'block') // Make the tooltip visible
                .html( // Change the html content of the <div> directly
                `<strong>${state}</strong><br/>
                Total ${yVar}: ${point?.value?.toFixed(2) ?? '—'}`)
                .style('left', (event.pageX + 20) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function (event, [state]) {
            d3.select('#tooltip')
                .style('display', 'none') // Hide tooltip when cursor leaves
            d3.select(this) // Refers to the line that the cursor left
                .style('stroke', null)
                .style('stroke-width', null);
        })
        .transition(t)
        .attr('d', ([, values]) => {
            values.sort((a, b) => {
                if (filterVar === "Year") {
                    return monthNames.indexOf(a.date) - monthNames.indexOf(b.date);
                }
                return a.date - b.date;
            });
            return line(values);
        })

    const periodLabel = filterVar === 'Year'
        ? 'Full Year 2017'
        : `${d3.timeFormat('%B')(new Date(2017, targetMonth - 1, 1))} 2017`;
    const scopeLabel = viewLevel === 'region' ? 'by Region' : `by State in ${activeRegion}`;
    d3.select('#value').text(`Total ${yVar} ${scopeLabel} — ${periodLabel}`);

    updateLegend(Array.from(byState.keys()));
}

function handleEntityClick(state){
    if (viewLevel === 'region') {
        activeRegion = state;
        viewLevel = 'state';
        selectedState = null;
        d3.select('#backToRegions').style('display', 'inline-block');
    } else if (selectedState === state) {
        selectedState = null;
    } else {
        selectedState = state;
    }
    updateVis();
}

function updateLegend(states){
    const itemsPerRow = Math.max(1, Math.floor(width / 80));

    const legendItems = svg.selectAll('.legend-item')
        .data(states, d => d);

    legendItems.exit().remove();

    const entered = legendItems.enter()
        .append('g')
        .attr('class', 'legend-item')
        .style('cursor', 'pointer');

    entered.append('rect').attr('width', 10).attr('height', 10);
    entered.append('text').attr('x', 16).attr('y', 10).style('font-size', '12px');

    const merged = entered.merge(legendItems);

    merged.attr('transform', (d, i) => {
        const row = Math.floor(i / itemsPerRow);
        const col = i % itemsPerRow;
        return `translate(${col * 80}, ${-margin.top + 20 + row * 18})`;
    });

    merged.select('rect').attr('fill', d => colorScale(d));
    merged.select('text').text(d => d);

    merged
        .on('click', (event, state) => handleEntityClick(state))
        .on('mouseover', (event, state) => {
            svg.selectAll('.line').filter(([s]) => s === state)
                .style('stroke', 'black')
                .style('stroke-width', '3px');
        })
        .on('mouseout', (event, state) => {
            svg.selectAll('.line').filter(([s]) => s === state)
                .style('stroke', null)
                .style('stroke-width', null);
        });
}

// function addLegend(){
// // Your turn, draw a set of rectangles using D3
//     svg.selectAll('rect')
//         .data(continents)
//         .enter()
//         .append('rect')
//         .attr("y", -margin.top/2 + size - 10) 
//         .attr("x", (d, i) => i * (size + 100) + 100)
//         .attr('width', 10)
//         .attr('height', 10)
//         .style("fill", d => colorScale(d)) 

//     svg.selectAll("continentName")
//         .data(continents)
//         .enter()
//         .append("text")
//         .attr("y", -margin.top/2 + size) // Align vertically with the square
//         .attr("x", (d, i) => i * (size + 100) + 120)  
//         .style("fill", d => colorScale(d))  // Match text color to the square
//         .text(d => d) // The actual continent name
//         .attr("text-anchor", "left")
//         .style('font-size', '13px')
// }

window.addEventListener('load', init);



/*

_____________________________CODE GRAVEYARD______________________
svg.selectAll('.line')
        .data(byState, ([state]) => state)
        .join(
            function(enter){
                return enter
                .join('path')
                .attr('class', 'line')
                .attr('fill', 'none')
                .attr('stroke', ([state]) => colorScale(state))
                .attr('stroke-width', 1.5)
                .transition(t)
                .attr('d', ([, values]) => line(values.sort((a, b) =>
                    filterVar === "Year"
                        ? monthNames.indexOf(a.date) - monthNames.indexOf(b.date)
                        : a.date - b.date
                )))
                // .on('mouseover', function (event, d) {
                //     console.log(d) // See the data point in the console for debugging
                //     d3.select('#tooltip')
                //     .style("display", 'block') // Make the tooltip visible
                //     .html( // Change the html content of the <div> directly
                //     `<strong>${d.state}</strong><br/>
                //     Precipitation (in): ${d.precipitation}`)
                //     .style("left", (event.pageX + 20) + "px")
                //     .style("top", (event.pageY - 28) + "px")
                //     d3.select(this) // Refers to the hovered circle
                //     .style('stroke', 'black')
                //     .style('stroke-width', '1px');
                // })
                // .on("mouseout", function (event, d) {
                //     d3.select('#tooltip')
                //     .style('display', 'none') // Hide tooltip when cursor leaves
                //     d3.select(this) // Refers to the hovered circle
                //     .style('stroke', 'none')
                // })
                .transition(t)                        
            },
            function(update){
                return update
                .transition(t)
                .attr('stroke', ([state]) => colorScale(state))
                .attr('d', ([, values]) =>
                    line(values.sort((a, b) => a.date - b.date))
                )
            },
            function(exit){
                exit
                .transition(t)
                .remove()
            }
        )
}


*/
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

let selectedState = null;
const t = 1000; // 1000ms = 1 second
let size = 10;  // Size of the legend squares
let label;


function aggregateData(mode, filter){
    const weatherType = weatherKeys[mode];

    if (filter == "Year"){
        // full year view
        const fullYearView = d3.rollup(
            allData,
            v => d3.mean(v, d => d[weatherType]),
            d => d.state,
            d => d.date.getMonth()
        );

        return fullYearView
    }
    else if (filter == "Months") {
        const currentData = allData.filter(d =>
            d.date.getMonth() + 1 === targetMonth
        );
        // Month view
        const monthlyView = d3.rollup(
            currentData,
            v => d3.mean(v, d => d[weatherType]),
            d => d.state,
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
        .on('click', (event, [state]) => {
            if (selectedState === state) {
                selectedState = null;
            } else {
                selectedState = state;
            }

            updateVis();
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
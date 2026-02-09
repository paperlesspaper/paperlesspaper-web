import React, { useState } from "react";
import { InlineLoading, Item } from "@progressiveui/react";
import eventList, { EventListContent } from "helpers/pillDispenser/events";
import moment from "moment";
import { iotDevicesApi } from "ducks/iotDevicesApi";
import { addDays, format, formatISO, subDays } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import DateRangePicker from "components/inputs/DateWeekPicker/DateRangePicker";
import JsonViewer from "components/JsonViewer";
import { Trans } from "react-i18next";

export default function SensorLog({ id }: any) {
  /*const [dateRange, setDateRange] = useState([
    formatISO(subDays(new Date(), 30), formatISO(addDays(new Date(), 30))),
  ]);*/

  const [startDate, setStartDate] = useState(subDays(new Date(), 14));
  const [endDate, setEndDate] = useState(addDays(new Date(), 1));

  const { data, isFetching } = iotDevicesApi.useGetEventsQuery(
    {
      id: id,
      params: {
        DateStart: formatISO(startDate),
        DateEnd: formatISO(endDate),
      },
    },
    { skip: id === undefined }
  );

  const filteredData = data?.message
    ? data.message.filter((e) => e.EventType === "env")
    : [];

  return (
    <>
      <h3>
        <Trans>Sensor log</Trans>
      </h3>
      <>
        <DateRangePicker
          startDate={startDate}
          onChangeStart={(date) => setStartDate(date)}
          onChangeEnd={(date) => setEndDate(date)}
          endDate={endDate}
        />
        <br />
      </>
      {filteredData.length > 0 && (
        <ResponsiveContainer width="100%" aspect={2}>
          <LineChart
            width={900}
            height={300}
            data={filteredData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              dataKey="EventTimestamp"
              domain={["auto", "auto"]}
              name="hour"
              tickFormatter={(unixTime) =>
                format(new Date(unixTime), "dd.MM HH:mm")
              }
              type="number"
            />

            <Legend />
            <YAxis
              allowDataOverflow
              type="number"
              domain={[0, 100]}
              yAxisId="aq"
              hide
            />
            <Line
              type="monotone"
              dataKey="EventMessage.aq"
              stroke="#E84500"
              activeDot={{ r: 8 }}
              name="Air quality"
              yAxisId="aq"
              unit="%"
            />
            <YAxis
              allowDataOverflow
              type="number"
              //domain={[-10, 30]}
              yAxisId="te"
              hide
            />
            <Line
              type="monotone"
              dataKey="EventMessage.te"
              stroke="#82ca9d"
              name="Temperatur"
              yAxisId="te"
              //TODO: Check formatter={(value) => value / 100}
              unit="°C"
            />
            <YAxis
              allowDataOverflow
              type="number"
              domain={["auto", "auto"]}
              yAxisId="pr"
              hide
            />
            <Line
              type="monotone"
              dataKey="EventMessage.pr"
              stroke="#00E886"
              activeDot={{ r: 8 }}
              name="pressure"
              yAxisId="pr"
              //formatter={(value) => value / 100}
              unit="kPa"
            />
            <YAxis allowDataOverflow type="number" yAxisId="hu" hide />
            <Line
              type="monotone"
              dataKey="EventMessage.hu"
              stroke="#8884d8"
              activeDot={{ r: 8 }}
              name="humidity"
              yAxisId="hu"
              //formatter={(value) => value / 100}
              unit="%"
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              labelFormatter={(t) => new Date(t).toLocaleString()}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      <br />
      <div>
        {isFetching ? (
          <InlineLoading description="Message log loading..." />
        ) : filteredData.length > 0 ? (
          filteredData.map((e, i) => (
            <Item
              key={i}
              //className={styles.item}
              kind="horizontal"
              wrapper="repeater"
              additional={moment(e.EventTimestamp).format("DD.MM.YYYY HH:mm")}
              title={eventList[e.EventType]?.name}
            >
              <EventListContent event={e} />
              <JsonViewer collapsed src={e} />
            </Item>
          ))
        ) : (
          <Trans>Nothing Found</Trans>
        )}
      </div>
    </>
  );
}

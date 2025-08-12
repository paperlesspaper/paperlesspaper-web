import { applications } from "@wirewire/helpers";

import ImageEditor from "./ImageEditor/Editor";
import WebsiteEditor from "./WebsiteEditor/WebsiteEditor";
import RssEditor from "./RssEditor/RssEditor";
import CalendarEditor from "./CalendarEditor/CalendarEditor";
import GoogleCalendarEditor from "./GoogleCalendarEditor/GoogleCalendarEditor";
import WeatherEditor from "./WeatherEditor/WeatherEditor";
import WikipediaEditor from "./WikipediaEditor/WikipediaEditor";
import SlidesEditor from "./SlidesEditor/SlidesEditor";

import babyIcon from "./assets/baby.png";
import wikipediaIcon from "./assets/wikipedia.png";
import rssIcon from "./assets/rss.png";
import websiteIcon from "./assets/website.png";
import slidesIcon from "./assets/slides.png";
import calendarIcon from "./assets/calendar.png";
import weatherIcon from "./assets/weather.png";
import googleCalendarIcon from "./assets/google-calendar.png";
import imageIcon from "./assets/image.png";
import BabyBirthEditor from "./BabyBirthEditor/BabyBirthEditor";
import GoogleNotesIcon from "./assets/google-notes.png";
//import GoogleNotesEditor from "./GoogleNotesEditor/GoogleNotesEditor";
import MoviesIcon from "./assets/movies.png";
import DaysSinceIcon from "./assets/days-since.png";
import DaysLeftIcon from "./assets/days-left.png";
import SunriseIcon from "./assets/sunrise.png";
import UpcomingMoviesEditor from "./UpcomingMovies/UpcomingMoviesEditor";
import DaysLeftEditor from "./DaysLeft/DaysLeftEditor";
import DaysSinceEditor from "./DaysSince/DaysSinceEditor";
import SunEditor from "./SunEditor/SunEditor";
import GoogleKeepEditor from "./GoogleKeepEditor/GoogleKeepEditor";

export const applicationsOnlyIcons = {
  image: { component: ImageEditor, icon: imageIcon },
  calendar: { component: CalendarEditor, icon: calendarIcon },
  baby: { component: BabyBirthEditor, icon: babyIcon },
  "google-calendar": {
    component: GoogleCalendarEditor,
    icon: googleCalendarIcon,
  },
  weather: { component: WeatherEditor, icon: weatherIcon },
  wikipedia: { component: WikipediaEditor, icon: wikipediaIcon },
  rss: { component: RssEditor, icon: rssIcon },
  website: { component: WebsiteEditor, icon: websiteIcon },
  slides: { component: SlidesEditor, icon: slidesIcon },
  "google-keep": {
    component: null,
    icon: GoogleKeepEditor,
  },
  "days-since": {
    component: DaysSinceEditor,
    icon: DaysSinceIcon,
  },
  "days-left": {
    component: DaysLeftEditor,
    icon: DaysLeftIcon,
  },
  movies: { component: UpcomingMoviesEditor, icon: MoviesIcon },
  sunrise: { component: SunEditor, icon: SunriseIcon },
};

const applicationsWithIcons: any = applications.map((app) => {
  return {
    ...app,
    icon: applicationsOnlyIcons[app.id]?.icon,
    component: applicationsOnlyIcons[app.id]?.component,
  };
});

export default applicationsWithIcons;

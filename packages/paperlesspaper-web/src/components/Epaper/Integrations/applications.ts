import { applications } from "@paperlesspaper/helpers";

import {
  faBaby,
  faBriefcaseMedical,
  faCalendarCheck,
  faCalendarDays,
  faClockRotateLeft,
  faCloudSun,
  faFilePowerpoint,
  faFilm,
  faGlobe,
  faHourglassHalf,
  faImage,
  faNoteSticky,
  faPrint,
  faRss,
  faSun,
} from "@fortawesome/pro-solid-svg-icons";
import { faWikipediaW } from "@fortawesome/free-brands-svg-icons";

import ImageEditor from "./ImageEditor/ImageEditor";
import WebsiteEditor from "./WebsiteEditor/WebsiteEditor";
import RssEditor from "./RssEditor/RssEditor";
import CalendarEditor from "./CalendarEditor/CalendarEditor";
import GoogleCalendarEditor from "./GoogleCalendarEditor/GoogleCalendarEditor";
import WeatherEditor from "./WeatherEditor/WeatherEditor";
import WikipediaEditor from "./WikipediaEditor/WikipediaEditor";
import SlidesEditor from "./SlidesEditor/SlidesEditor";
import PlaylistEditor from "./PlaylistEditor/PlaylistEditor";
import ApothekenNotdienstEditor from "./ApothekenNotdienstEditor/ApothekenNotdienstEditor";
import OpenIntegrationEditor from "./OpenIntegrationEditor/OpenIntegrationEditor";

import babyIcon from "./assets/thumbnails/baby.png";
import wikipediaIcon from "./assets/thumbnails/wikipedia.png";
import rssIcon from "./assets/thumbnails/rss.png";
import websiteIcon from "./assets/thumbnails/website.png";
import slidesIcon from "./assets/thumbnails/slides.png";
import calendarIcon from "./assets/thumbnails/calendar.png";
import weatherIcon from "./assets/thumbnails/weather.png";
import googleCalendarIcon from "./assets/thumbnails/google-calendar.png";
import imageIcon from "./assets/thumbnails/image.png";
import apothekenIcon from "./assets/thumbnails/pharmacy.png";
import BabyBirthEditor from "./BabyBirthEditor/BabyBirthEditor";
import GoogleNotesIcon from "./assets/thumbnails/google-notes.png";
import printerIcon from "./assets/thumbnails/printer.png";
import playlistIcon from "./assets/thumbnails/playlist.png";
//import GoogleNotesEditor from "./GoogleNotesEditor/GoogleNotesEditor";
import MoviesIcon from "./assets/thumbnails/movies.png";
import DaysSinceIcon from "./assets/thumbnails/days-since.png";
import DaysLeftIcon from "./assets/thumbnails/days-left.png";
import SunriseIcon from "./assets/thumbnails/sunrise.png";
import UpcomingMoviesEditor from "./UpcomingMovies/UpcomingMoviesEditor";
import DaysLeftEditor from "./DaysLeft/DaysLeftEditor";
import DaysSinceEditor from "./DaysSince/DaysSinceEditor";
import SunEditor from "./SunEditor/SunEditor";
import PrinterEditor from "./PrinterEditor/PrinterEditor";
import ApplePhotosRandomOpenIntegrationEditor from "./ApplePhotosRandomOpenIntegrationEditor/ApplePhotosRandomOpenIntegrationEditor";
import MultiImageUploadEditor from "./MultiImageUploadEditor/MultiImageUploadEditor";

export const applicationsOnlyIcons = {
  image: { component: ImageEditor, icon: imageIcon, iconSimple: faImage },
  "image-multi-upload": {
    component: MultiImageUploadEditor,
    icon: imageIcon,
    iconSimple: faImage,
  },
  "apple-photos-random": {
    component: ApplePhotosRandomOpenIntegrationEditor,
    icon: imageIcon,
    iconSimple: faImage,
  },
  calendar: {
    component: CalendarEditor,
    icon: calendarIcon,
    iconSimple: faCalendarDays,
  },
  baby: { component: BabyBirthEditor, icon: babyIcon, iconSimple: faBaby },
  apothekennotdienst: {
    component: ApothekenNotdienstEditor,
    icon: apothekenIcon,
    iconSimple: faBriefcaseMedical,
  },
  "google-calendar": {
    component: GoogleCalendarEditor,
    icon: googleCalendarIcon,
    iconSimple: faCalendarCheck,
  },
  weather: {
    component: WeatherEditor,
    icon: weatherIcon,
    iconSimple: faCloudSun,
  },
  wikipedia: {
    component: WikipediaEditor,
    icon: wikipediaIcon,
    iconSimple: faWikipediaW,
  },
  rss: { component: RssEditor, icon: rssIcon, iconSimple: faRss },
  website: { component: WebsiteEditor, icon: websiteIcon, iconSimple: faGlobe },
  plugin: {
    component: OpenIntegrationEditor,
    icon: websiteIcon,
    iconSimple: faGlobe,
  },
  slides: {
    component: SlidesEditor,
    icon: slidesIcon,
    iconSimple: faFilePowerpoint,
  },
  playlist: {
    component: PlaylistEditor,
    icon: playlistIcon,
    iconSimple: faCalendarDays,
  },
  "google-keep": {
    component: null,
    icon: GoogleNotesIcon,
    iconSimple: faNoteSticky,
  },
  "days-since": {
    component: DaysSinceEditor,
    icon: DaysSinceIcon,
    iconSimple: faClockRotateLeft,
  },
  "days-left": {
    component: DaysLeftEditor,
    icon: DaysLeftIcon,
    iconSimple: faHourglassHalf,
  },
  movies: {
    component: UpcomingMoviesEditor,
    icon: MoviesIcon,
    iconSimple: faFilm,
  },
  sunrise: { component: SunEditor, icon: SunriseIcon, iconSimple: faSun },
  printer: { component: PrinterEditor, icon: printerIcon, iconSimple: faPrint },
};

const applicationsWithIcons: any = applications.map((app) => {
  return {
    ...app,
    icon: applicationsOnlyIcons[app.id]?.icon,
    component: applicationsOnlyIcons[app.id]?.component,
    iconSimple: applicationsOnlyIcons[app.id]?.iconSimple,
  };
});

export default applicationsWithIcons;

import React, { useState, useEffect } from "react";
import { Trans } from "react-i18next";

type PleaseWaitTimerProps = {
  initialTime: number;
  onFinished: () => void;
};

const PleaseWaitTimer: React.FC<PleaseWaitTimerProps> = ({
  initialTime,
  onFinished,
}) => {
  const [time, setTime] = useState<any>(initialTime);

  useEffect(() => {
    if (time <= 0) {
      onFinished(); // Call the onFinished callback when the timer reaches 0
      return; // Stop the timer
    }

    const timerId = setInterval(() => {
      setTime((prevTime) => prevTime - 1);
    }, 1000);

    return () => clearInterval(timerId); // Cleanup the interval on component unmount
  }, [time, onFinished]);

  return (
    <Trans i18nKey="PLEASE_WAIT_SECONDS">
      Please wait <span>{time}</span> seconds
    </Trans>
  );
};

export default PleaseWaitTimer;

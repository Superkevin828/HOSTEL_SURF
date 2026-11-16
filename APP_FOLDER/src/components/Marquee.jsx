import Icon from '../lib/icons';

const SLOGANS = ['Rooms near campus', 'Call in one tap', 'Real prices', 'Direct owner contact'];

function Line() {
  return (
    <span className="marquee-line">
      {SLOGANS.map((slogan) => (
        <span className="marquee-item" key={slogan}>
          {slogan}
          <Icon name="spark" className="marquee-star" />
        </span>
      ))}
    </span>
  );
}

export default function Marquee() {
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        <Line />
        <Line />
        <Line />
      </div>
    </div>
  );
}

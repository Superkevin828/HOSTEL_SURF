import Icon from '../lib/icons';

export default function Stars({ label = '4.9 out of 5 from students' }) {
  return (
    <div className="social-proof">
      <span className="rating-stars" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((index) => (
          <Icon name="star" key={index} />
        ))}
      </span>
      <span>{label}</span>
    </div>
  );
}

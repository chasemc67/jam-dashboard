import React, { useState } from 'react';

const LikeCounter = () => {
    const [likes, setLikes] = useState(0);

    const incrementLikes = () => setLikes(likes + 1);

    return (
        <div>
            <p>Likes: {likes}</p>
            <button onClick={incrementLikes}>Like</button>
        </div>
    );
};

export default LikeCounter;

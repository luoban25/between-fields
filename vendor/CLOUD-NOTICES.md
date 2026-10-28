# Wilderness cloud experiment

The volumetric density texture and front-to-back ray integration in
`works/wilderness/cloud-volume.js` are adapted from the Three.js r180 example:
https://github.com/mrdoob/three.js/blob/r180/examples/webgl_volume_cloud.html

`ImprovedNoise.js` is vendored from:
https://github.com/mrdoob/three.js/blob/r180/examples/jsm/math/ImprovedNoise.js
Its only modification is resolving the local Three.js module import.

Copyright (c) 2010-2025 three.js authors. MIT License.
The complete permission and warranty notice is retained in `THREE-LICENSE.txt`.

The orthographic rays, altitude-split composite, density-linked ground shadow,
flowing wisps, and fixed-sample low-resolution buffers are scene adaptations.
No Drei, Quarks, React, remote cloud API, or generated video is loaded at runtime.
